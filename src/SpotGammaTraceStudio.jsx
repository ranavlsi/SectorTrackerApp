import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Camera, Info, ChevronDown, ChevronUp, RotateCcw,
  Activity, Flame, Shield, Layers
} from 'lucide-react';

const LENS_META = {
  gex: {
    title: 'Gamma Exposure (GEX)',
    short: 'GEX',
    posMeaning: 'Positive Gamma (Dealers Buy Dips / Sell Rallies · Pinning)',
    negMeaning: 'Negative Gamma (Dealers Chase Moves · Vol Expansion)',
    posColor: '#00E676',
    negColor: '#ff3366',
  },
  dex: {
    title: 'Delta Pressure (DEX)',
    short: 'DEX',
    posMeaning: 'Long Dealer Delta Cushion (Supportive Accumulation)',
    negMeaning: 'Short Dealer Delta Supply (Overhead Resistance)',
    posColor: '#38bdf8',
    negColor: '#fb7185',
  },
  cex: {
    title: 'Charm Decay Flow (CEX)',
    short: 'CEX',
    posMeaning: 'Positive Time-Decay Drift (Dealer Bid Into Close)',
    negMeaning: 'Negative Time-Decay Drift (Dealer Supply Into Close)',
    posColor: '#c084fc',
    negColor: '#f43f5e',
  },
  vex: {
    title: 'Vanna Vol Sensitivity (VEX)',
    short: 'VEX',
    posMeaning: 'Positive Vanna (IV Crush Forces Dealer Buying)',
    negMeaning: 'Negative Vanna (IV Spike Forces Dealer Selling)',
    posColor: '#22d3ee',
    negColor: '#fb923c',
  },
};

// Dark-luxury institutional heatmap scale: keeps 0 obsidian so green/red candles stay needle-sharp
const TRACE_COLORSCALE = [
  [0.0, '#e11d48'],
  [0.16, '#9f1239'],
  [0.32, '#581024'],
  [0.44, '#141926'],
  [0.5, '#070b14'],
  [0.56, '#0d1f22'],
  [0.68, '#064e3b'],
  [0.86, '#059669'],
  [1.0, '#00f0ff'],
];

const STRESS_SHIFTS = [-6, -3, 0, 3, 6];

export const fmtMillions = (mVal, suffix = '') => {
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

export const fmtRawDollars = (val, suffix = '') => fmtMillions((Number(val) || 0) / 1e6, suffix);

export const fmtCompactShares = (val) => {
  if (val === undefined || val === null || Number.isNaN(Number(val))) return '0 shs';
  const n = Number(val);
  const absN = Math.abs(n);
  if (absN >= 1e6) return `${(n / 1e6).toFixed(2)}M shs`;
  if (absN >= 1e3) return `${(n / 1e3).toFixed(0)}K shs`;
  return `${Math.round(n).toLocaleString()} shs`;
};

function interpolateZeroCrossing(prices, vals, spot) {
  if (!Array.isArray(prices) || !Array.isArray(vals) || prices.length !== vals.length) return null;
  const roots = [];
  for (let i = 0; i < prices.length - 1; i += 1) {
    const v1 = Number(vals[i]);
    const v2 = Number(vals[i + 1]);
    if ((v1 < 0 && v2 > 0) || (v1 > 0 && v2 < 0) || (v1 === 0 && v2 !== 0)) {
      const dv = v2 - v1;
      if (dv !== 0) {
        const f = Math.max(0, Math.min(1, -v1 / dv));
        roots.push(Number((prices[i] + f * (prices[i + 1] - prices[i])).toFixed(2)));
      }
    }
  }
  if (roots.length === 0) return null;
  return roots.reduce((best, r) => (Math.abs(r - spot) < Math.abs(best - spot) ? r : best), roots[0]);
}

// Measure responsive plot width cleanly so layout never collides at narrow panes
function useElementWidth(ref) {
  const [width, setWidth] = useState(1200);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [ref]);
  return width;
}

export default function SpotGammaTraceStudio({
  ticker,
  spot,
  spotgammaTrace,
  keyLevels,
  expectedMove,
  plotlyReady,
  liveOptionFlow,
  dataMeta,
}) {
  const [viewMode, setViewMode] = useState('studio'); // 'studio' | 'ladder' | 'curve'
  const [lens, setLens] = useState('gex'); // 'gex' | 'dex' | 'cex' | 'vex'
  const [scope, setScope] = useState('all'); // 'all' | 'weekly' | 'front'
  const [source, setSource] = useState('oi'); // 'oi' | 'vol'
  const [zoomMode, setZoomMode] = useState('smart'); // 'smart' | '5' | '8' | '12'
  const [fieldMode, setFieldMode] = useState('liquidity'); // 'liquidity' | 'regime'
  const [flowPanelMode, setFlowPanelMode] = useState('live_flow'); // 'live_flow' | 'oi_hiro'
  const [priceStyle, setPriceStyle] = useState('candles'); // 'candles' | 'line'
  const [smoothMode, setSmoothMode] = useState('smooth'); // 'smooth' | 'discrete'
  const [ladderStyle, setLadderStyle] = useState('net_curve'); // 'net_curve' | 'split' | 'abs'
  const [showLevels, setShowLevels] = useState(true);
  const [showSignals, setShowSignals] = useState(true);
  const [ivShift, setIvShift] = useState(0); // -6 .. 6
  const [showGuide, setShowGuide] = useState(false);

  const plotRef = useRef(null);
  const plotWidth = useElementWidth(plotRef);

  const meta = LENS_META[lens] || LENS_META.gex;
  const spotVal = Number(spotgammaTrace?.spot_price || spot || 0);

  const scopeData = useMemo(() => {
    const scopes = spotgammaTrace?.scopes;
    if (scopes && scopes[scope]) return scopes[scope];
    return {
      expiry_label: 'All Chain',
      strikes: spotgammaTrace?.strike_distribution || [],
      curve: spotgammaTrace?.curve || [],
      call_wall: keyLevels?.call_wall,
      put_wall: keyLevels?.put_wall,
      key_gamma_strike: spotgammaTrace?.key_gamma_strike || keyLevels?.absolute_gamma,
      key_gamma_abs: spotgammaTrace?.key_gamma_val || 0,
      key_gamma_net: spotgammaTrace?.key_gamma_net || 0,
      trace_zero_gamma: spotgammaTrace?.trace_zero_gamma ?? null,
      trace_zero_gamma_found: Boolean(spotgammaTrace?.trace_zero_gamma_found),
      trace_zero_gamma_note: spotgammaTrace?.trace_zero_gamma_note || 'Uniform Regime',
      current_spot_gex: spotgammaTrace?.current_spot_gex || 0,
      current_spot_dex: spotgammaTrace?.current_spot_dex || 0,
      current_spot_cex: spotgammaTrace?.current_spot_cex || 0,
      current_spot_vex: spotgammaTrace?.current_spot_vex || 0,
      has_live_vol: true,
      dollars_per_dollar_move: spotgammaTrace?.hedging_ruler?.gex_per_1_dollar_m ? Math.abs(spotgammaTrace.hedging_ruler.gex_per_1_dollar_m) * 1e6 : 0,
      shares_per_dollar_move: spotgammaTrace?.hedging_ruler?.shares_per_1_dollar || 0,
      shares_per_1pct_move: spotgammaTrace?.hedging_ruler?.shares_per_1pct || 0,
    };
  }, [spotgammaTrace, scope, keyLevels]);

  const ivStressResolved = useMemo(() => {
    const isc = spotgammaTrace?.iv_stress_curves;
    const suffix = lens === 'gex' ? 'net_gex_m' : (lens === 'dex' ? 'net_dex_m' : (lens === 'cex' ? 'net_cex_m' : 'net_vex_m'));
    const spotKey = lens === 'gex' ? 'spot_gex_m' : (lens === 'dex' ? 'spot_dex_m' : (lens === 'cex' ? 'spot_cex_m' : 'spot_vex_m'));

    if (!isc?.shifts || !isc?.prices?.length || scope !== 'all') {
      const scCurve = scopeData?.curve || [];
      const fallbackY = scCurve.map((pt) => (Number(pt[`net_${lens}`] || 0) / 1e6));
      const fallbackPrices = scCurve.map((pt) => Number(pt.price));
      const baseSpotM = (Number(scopeData?.[`current_spot_${lens}`] || 0)) / 1e6;
      return {
        prices: fallbackPrices,
        curveM: fallbackY,
        spotM: baseSpotM,
        zeroGamma: scopeData?.trace_zero_gamma ?? null,
      };
    }

    let lo = -6;
    let hi = 6;
    for (let i = 0; i < STRESS_SHIFTS.length - 1; i += 1) {
      if (ivShift >= STRESS_SHIFTS[i] && ivShift <= STRESS_SHIFTS[i + 1]) {
        lo = STRESS_SHIFTS[i];
        hi = STRESS_SHIFTS[i + 1];
        break;
      }
    }
    const w = hi === lo ? 0 : (ivShift - lo) / (hi - lo);
    const sLo = isc.shifts[String(lo)] || isc.shifts['0'];
    const sHi = isc.shifts[String(hi)] || isc.shifts['0'];
    const arrLo = sLo?.[suffix] || [];
    const arrHi = sHi?.[suffix] || [];
    const curveM = isc.prices.map((_, idx) => {
      const a = Number(arrLo[idx] ?? 0);
      const b = Number(arrHi[idx] ?? a);
      return Number((a + w * (b - a)).toFixed(2));
    });
    const spotM = Number(((Number(sLo?.[spotKey] ?? 0)) + w * ((Number(sHi?.[spotKey] ?? 0)) - (Number(sLo?.[spotKey] ?? 0)))).toFixed(2));

    let zg = scopeData?.trace_zero_gamma ?? null;
    if (ivShift !== 0 && lens === 'gex') {
      const gexLo = isc.shifts[String(lo)]?.net_gex_m || [];
      const gexHi = isc.shifts[String(hi)]?.net_gex_m || [];
      const gexMorphed = isc.prices.map((_, idx) => Number(gexLo[idx] ?? 0) + w * (Number(gexHi[idx] ?? 0) - Number(gexLo[idx] ?? 0)));
      zg = interpolateZeroCrossing(isc.prices, gexMorphed, spotVal);
    }

    return {
      prices: isc.prices,
      curveM,
      spotM,
      zeroGamma: zg,
    };
  }, [spotgammaTrace, lens, scope, scopeData, ivShift, spotVal]);

  const yBounds = useMemo(() => {
    if (!spotVal) return [0, 100];
    const intro = spotgammaTrace?.intraday;
    const sLow = Number(intro?.session_low || spotVal);
    const sHigh = Number(intro?.session_high || spotVal);

    if (zoomMode !== 'smart') {
      const pct = Number(zoomMode) / 100.0;
      const lo = Math.min(spotVal * (1 - pct), sLow * 0.996);
      const hi = Math.max(spotVal * (1 + pct), sHigh * 1.004);
      return [Number(lo.toFixed(2)), Number(hi.toFixed(2))];
    }

    const candidates = [
      spotVal * 0.945,
      spotVal * 1.055,
      sLow * 0.994,
      sHigh * 1.006,
    ];
    if (expectedMove?.range_1d?.length === 2) {
      candidates.push(Number(expectedMove.range_1d[0]) * 0.995, Number(expectedMove.range_1d[1]) * 1.005);
    }
    const maybeAddNearWall = (lvl) => {
      const v = Number(lvl);
      if (Number.isFinite(v) && v > 0 && Math.abs(v - spotVal) / spotVal <= 0.13) {
        candidates.push(v > spotVal ? v * 1.008 : v * 0.992);
      }
    };
    maybeAddNearWall(scopeData?.call_wall);
    maybeAddNearWall(scopeData?.put_wall);
    maybeAddNearWall(scopeData?.key_gamma_strike);
    maybeAddNearWall(ivStressResolved.zeroGamma);

    const lo = Math.max(spotVal * 0.85, Math.min(...candidates));
    const hi = Math.min(spotVal * 1.15, Math.max(...candidates));
    return [Number(lo.toFixed(2)), Number(hi.toFixed(2))];
  }, [spotVal, spotgammaTrace, zoomMode, expectedMove, scopeData, ivStressResolved.zeroGamma]);

  const visibleStrikes = useMemo(() => {
    const raw = scopeData?.strikes || [];
    const [yMin, yMax] = yBounds;
    const filtered = raw.filter((s) => s.strike >= yMin && s.strike <= yMax);
    if (filtered.length >= 6) return filtered;
    return raw.filter((s) => Math.abs(s.strike - spotVal) / (spotVal || 1) <= 0.12);
  }, [scopeData, yBounds, spotVal]);

  const strikeRowsM = useMemo(() => {
    const pfx = source === 'vol' ? 'vol_' : '';
    const cKey = `${pfx}call_${lens}`;
    const pKey = `${pfx}put_${lens}`;
    const nKey = `${pfx}net_${lens}`;
    const aKey = `${pfx}abs_${lens}`;

    return visibleStrikes.map((s) => ({
      strike: Number(s.strike),
      pct: Number(s.pct_from_spot || 0),
      callM: Number(s[cKey] || 0) / 1e6,
      putM: Number(s[pKey] || 0) / 1e6,
      netM: Number(s[nKey] || 0) / 1e6,
      absM: Number(s[aKey] || 0) / 1e6,
      callOi: Number(s.call_oi || 0),
      putOi: Number(s.put_oi || 0),
      callVol: Number(s.call_vol || 0),
      putVol: Number(s.put_vol || 0),
    }));
  }, [visibleStrikes, source, lens]);

  const scenarios = useMemo(() => {
    const prices = ivStressResolved.prices || [];
    const curveM = ivStressResolved.curveM || [];
    if (!prices.length || !curveM.length || !spotVal) return null;

    const sampleAt = (targetP) => {
      let bestI = 0;
      let bestD = Infinity;
      prices.forEach((p, idx) => {
        const d = Math.abs(p - targetP);
        if (d < bestD) {
          bestD = d;
          bestI = idx;
        }
      });
      return { price: prices[bestI], valM: curveM[bestI] };
    };

    return {
      down: sampleAt(spotVal * 0.98),
      cur: { price: spotVal, valM: ivStressResolved.spotM },
      up: sampleAt(spotVal * 1.02),
    };
  }, [ivStressResolved, spotVal]);

  const handleExportPng = () => {
    if (!plotRef.current || !window.Plotly) return;
    try {
      window.Plotly.downloadImage(plotRef.current, {
        format: 'png',
        width: 1600,
        height: 920,
        filename: `${ticker}_SpotGamma_TRACE_${viewMode}_${lens}`,
      });
    } catch (e) {
      console.warn('TRACE PNG export failed:', e);
    }
  };

  useEffect(() => {
    if (!plotlyReady || !plotRef.current || !window.Plotly || !spotgammaTrace || !spotVal) return undefined;

    const plotEl = plotRef.current;
    const isNarrow = plotWidth < 860;
    const [yMin, yMax] = yBounds;
    const ySpan = Math.max(0.5, yMax - yMin);
    const isDarkText = (bgHex) => bgHex === '#ffffff' || bgHex === '#00E676' || bgHex === '#00F0FF' || bgHex === '#fbbf24' || bgHex === '#f59e0b';

    const buildLevelSpecs = () => {
      const list = [
        { val: spotVal, label: `SPOT $${spotVal.toFixed(1)}`, bg: '#ffffff', line: 'rgba(255,255,255,0.88)', dash: 'dash', w: 2.0 },
      ];
      if (scopeData?.call_wall && scopeData.call_wall >= yMin && scopeData.call_wall <= yMax) {
        list.push({ val: Number(scopeData.call_wall), label: `CW $${Number(scopeData.call_wall).toFixed(0)}`, bg: '#00E676', line: 'rgba(0,230,118,0.75)', dash: 'dot', w: 1.5 });
      }
      if (scopeData?.put_wall && scopeData.put_wall >= yMin && scopeData.put_wall <= yMax) {
        list.push({ val: Number(scopeData.put_wall), label: `PW $${Number(scopeData.put_wall).toFixed(0)}`, bg: '#ff3366', line: 'rgba(255,51,102,0.8)', dash: 'dot', w: 1.5 });
      }
      if (ivStressResolved.zeroGamma && ivStressResolved.zeroGamma >= yMin && ivStressResolved.zeroGamma <= yMax) {
        list.push({ val: Number(ivStressResolved.zeroGamma), label: `FLIP $${Number(ivStressResolved.zeroGamma).toFixed(1)}`, bg: '#fbbf24', line: '#fbbf24', dash: 'dashdot', w: 2.0 });
      }
      if (scopeData?.key_gamma_strike && scopeData.key_gamma_strike >= yMin && scopeData.key_gamma_strike <= yMax) {
        const sameAsPw = Math.abs(scopeData.key_gamma_strike - (scopeData.put_wall || -999)) < 0.1;
        const sameAsCw = Math.abs(scopeData.key_gamma_strike - (scopeData.call_wall || -999)) < 0.1;
        if (!sameAsPw && !sameAsCw) {
          list.push({ val: Number(scopeData.key_gamma_strike), label: `PIN $${Number(scopeData.key_gamma_strike).toFixed(0)}`, bg: '#38bdf8', line: 'rgba(56,189,248,0.65)', dash: 'dot', w: 1.3 });
        }
      }
      if (expectedMove?.range_1d?.length === 2) {
        const lo1 = Number(expectedMove.range_1d[0]);
        const hi1 = Number(expectedMove.range_1d[1]);
        if (hi1 <= yMax && hi1 >= yMin) {
          list.push({ val: hi1, label: `+1σ $${hi1.toFixed(1)}`, bg: '#00F0FF', line: 'rgba(0,240,255,0.45)', dash: 'dot', w: 1.1 });
        }
        if (lo1 <= yMax && lo1 >= yMin) {
          list.push({ val: lo1, label: `-1σ $${lo1.toFixed(1)}`, bg: '#00F0FF', line: 'rgba(0,240,255,0.45)', dash: 'dot', w: 1.1 });
        }
      }
      return list;
    };

    try {
      // =========================================================================
      // VIEW 1: DUAL SYNCHRONIZED TRACE STUDIO (STRIKE LADDER + HEATMAP + HIRO)
      // =========================================================================
      if (viewMode === 'studio') {
        const hm = spotgammaTrace.intraday_heatmap;
        const intro = spotgammaTrace.intraday;
        const hiro = spotgammaTrace.hiro_series || [];
        const hiroSum = spotgammaTrace.hiro_summary || {};
        const bars = intro?.bars || [];

        const rawMatrix = (fieldMode === 'liquidity' ? hm?.liquidity_bands?.[lens] : hm?.regime_field?.[lens]) || [];
        const hmPrices = hm?.prices || [];
        const hmMins = hm?.time_mins || [];

        const rowIdx = [];
        hmPrices.forEach((p, idx) => {
          if (p >= yMin - ySpan * 0.04 && p <= yMax + ySpan * 0.04) rowIdx.push(idx);
        });
        const visHmPrices = (rowIdx.length > 4 ? rowIdx.map((i) => hmPrices[i]) : hmPrices);
        const visHmZ = (rowIdx.length > 4 ? rowIdx.map((i) => rawMatrix[i] || []) : rawMatrix);

        const flatAbs = visHmZ.flat().map((v) => Math.abs(Number(v) || 0)).filter(Number.isFinite).sort((a, b) => a - b);
        const p96 = flatAbs.length ? flatAbs[Math.min(flatAbs.length - 1, Math.floor(flatAbs.length * 0.96))] : 1;
        const zBound = Math.max(p96, 0.25);

        const hmHover = visHmPrices.map((p, rLocalIdx) => {
          const origIdx = rowIdx.length > 4 ? rowIdx[rLocalIdx] : rLocalIdx;
          const dp = ((p - spotVal) / spotVal) * 100;
          return hmMins.map((m, cIdx) => {
            const hh = Math.floor((9 * 60 + 30 + m) / 60);
            const mm = (9 * 60 + 30 + m) % 60;
            const tStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ET`;
            const liqV = Number(hm?.liquidity_bands?.[lens]?.[origIdx]?.[cIdx] ?? visHmZ[rLocalIdx]?.[cIdx] ?? 0);
            const regV = Number(hm?.regime_field?.[lens]?.[origIdx]?.[cIdx] ?? 0);
            const activeV = fieldMode === 'liquidity' ? liqV : regV;
            return `<b>$${Number(p).toFixed(2)}</b> (${dp >= 0 ? '+' : ''}${dp.toFixed(1)}%) · <b>${tStr}</b><br>` +
                   `${fieldMode === 'liquidity' ? 'Strike Liquidity' : 'Macro Regime'} (${meta.short}): <b>${fmtMillions(activeV)}</b><br>` +
                   `<span style="color:#94a3b8">Local: ${fmtMillions(liqV)} · Macro: ${fmtMillions(regV)}</span><br>` +
                   `<b>${activeV >= 0 ? meta.posMeaning : meta.negMeaning}</b>`;
          });
        });

        const strikesSorted = strikeRowsM.map((r) => r.strike);
        let minStep = ySpan * 0.04;
        for (let i = 1; i < strikesSorted.length; i += 1) {
          const d = strikesSorted[i] - strikesSorted[i - 1];
          if (d > 0 && d < minStep) minStep = d;
        }
        const barWidth = Math.max(ySpan * 0.012, Math.min(minStep * 0.72, ySpan * 0.045));

        // Responsive subplot domain coordinates preventing collisions at both 1123px and 1680px
        const leftEnd = isNarrow ? 0.235 : 0.225;
        const centerStart = isNarrow ? 0.305 : 0.275;
        const centerEnd = isNarrow ? 0.805 : 0.858;
        const badgeX = centerEnd + 0.006;
        const cbX = isNarrow ? 0.935 : 0.952;

        const traces = [
          {
            type: 'bar',
            orientation: 'h',
            name: `${source === 'vol' ? 'Vol' : 'OI'} Net ${meta.short}`,
            x: strikeRowsM.map((r) => r.netM),
            y: strikeRowsM.map((r) => r.strike),
            width: barWidth,
            xaxis: 'x',
            yaxis: 'y',
            marker: {
              color: strikeRowsM.map((r) => (r.netM >= 0 ? meta.posColor : meta.negColor)),
              opacity: 0.92,
              line: { width: 0 },
            },
            customdata: strikeRowsM.map((r) => [r.pct, r.callM, r.putM, r.absM, r.callOi, r.putOi, r.callVol, r.putVol]),
            hovertemplate:
              '<b>Strike $%{y:.2f}</b> (%{customdata[0]:+.1f}%)<br>' +
              `Net ${meta.short}: <b>%{x:+.2f}M</b><br>` +
              'Call: %{customdata[1]:+.2f}M · Put: %{customdata[2]:+.2f}M · Abs: $%{customdata[3]:.1f}M<br>' +
              'OI: %{customdata[4]:,.0f}C / %{customdata[5]:,.0f}P · Vol: %{customdata[6]:,.0f}C / %{customdata[7]:,.0f}P' +
              '<extra></extra>',
          },
        ];

        const sdePairs = (ivStressResolved.prices || [])
          .map((p, idx) => ({ p, v: ivStressResolved.curveM[idx] }))
          .filter((pt) => pt.p >= yMin && pt.p <= yMax);
        if (sdePairs.length >= 2) {
          traces.push({
            type: 'scatter',
            mode: 'lines',
            name: `SDE Curve${ivShift !== 0 ? ` (${ivShift > 0 ? '+' : ''}${ivShift}% IV)` : ''}`,
            x: sdePairs.map((pt) => pt.v),
            y: sdePairs.map((pt) => pt.p),
            xaxis: 'x4',
            yaxis: 'y',
            line: { color: '#00F0FF', width: 2.3 },
            hovertemplate: `Portfolio SDE (${meta.short}): <b>%{x:+.2f}M</b> @ $${'{y:.2f}'}<extra></extra>`,
          });
        }

        if (visHmPrices.length && visHmZ.length && hmMins.length) {
          traces.push({
            type: 'heatmap',
            name: fieldMode === 'liquidity' ? 'Liquidity Map' : 'Regime Field',
            x: hmMins,
            y: visHmPrices,
            z: visHmZ,
            text: hmHover,
            hoverinfo: 'text',
            xaxis: 'x2',
            yaxis: 'y2',
            zsmooth: smoothMode === 'smooth' ? 'best' : false,
            zmin: -zBound,
            zmax: zBound,
            zmid: 0,
            colorscale: TRACE_COLORSCALE,
            colorbar: {
              title: { text: `${meta.short} ($M)`, font: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 9.5 } },
              tickfont: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 8.5 },
              x: cbX,
              xanchor: 'left',
              len: 0.72,
              y: 0.615,
              yanchor: 'middle',
              thickness: isNarrow ? 10 : 12,
              outlinewidth: 0,
            },
          });
        }

        const zgTimes = hm?.zero_gamma_by_time || [];
        const zgPts = [];
        zgTimes.forEach((zv, i) => {
          if (zv !== null && zv !== undefined && zv >= yMin && zv <= yMax) {
            zgPts.push({ m: hmMins[i], z: zv });
          }
        });
        if (zgPts.length >= 2 && lens === 'gex' && ivShift === 0) {
          traces.push({
            type: 'scatter',
            mode: 'lines',
            name: 'Flip Trajectory',
            x: zgPts.map((d) => d.m),
            y: zgPts.map((d) => d.z),
            xaxis: 'x2',
            yaxis: 'y2',
            line: { color: '#fbbf24', width: 2.0, dash: 'dashdot' },
            hovertemplate: 'Vol Trigger Trajectory: <b>$%{y:.2f}</b><extra></extra>',
          });
        }

        if (bars.length > 0) {
          if (priceStyle === 'candles' && !intro?.is_synthetic) {
            traces.push({
              type: 'candlestick',
              name: `${ticker} 5m`,
              x: bars.map((b) => b.min_idx),
              open: bars.map((b) => b.o),
              high: bars.map((b) => b.h),
              low: bars.map((b) => b.l),
              close: bars.map((b) => b.c),
              xaxis: 'x2',
              yaxis: 'y2',
              increasing: { line: { color: '#6ee7b7', width: 1.3 }, fillcolor: '#00E676' },
              decreasing: { line: { color: '#fecdd3', width: 1.3 }, fillcolor: '#ff3366' },
              whiskerwidth: 0.45,
            });
          } else {
            traces.push({
              type: 'scatter',
              mode: 'lines',
              name: `${ticker} Price`,
              x: bars.map((b) => b.min_idx),
              y: bars.map((b) => b.c),
              xaxis: 'x2',
              yaxis: 'y2',
              line: { color: '#ffffff', width: 2.4 },
              hovertemplate: 'Price: <b>$%{y:.2f}</b><extra></extra>',
            });
          }

          if (!intro?.is_synthetic) {
            traces.push({
              type: 'scatter',
              mode: 'lines',
              name: 'VWAP',
              x: bars.map((b) => b.min_idx),
              y: bars.map((b) => b.vwap),
              xaxis: 'x2',
              yaxis: 'y2',
              line: { color: '#fbbf24', width: 1.5, dash: 'dot' },
              hoverinfo: 'text',
              text: bars.map((b) => `${b.t} ET · VWAP: $${b.vwap.toFixed(2)}`),
            });
          }

          const lastBar = bars[bars.length - 1];
          traces.push({
            type: 'scatter',
            mode: 'markers',
            name: `Spot $${spotVal.toFixed(2)}`,
            x: [lastBar.min_idx],
            y: [spotVal],
            xaxis: 'x2',
            yaxis: 'y2',
            marker: { symbol: 'star', size: 11, color: '#ffffff', line: { color: '#040812', width: 1.2 } },
            showlegend: false,
            hovertemplate: `Live Spot: <b>$${spotVal.toFixed(2)}</b><extra></extra>`,
          });
        }

        // Bottom Panel: Live All-Expiry Volume Flow + Velocity/Accel OR Static OI HIRO
        const lfSeries = liveOptionFlow?.flow_series || [];
        const useLiveFlowPanel = flowPanelMode === 'live_flow' && lfSeries.length > 0;
        const maxBottomAbsM = useLiveFlowPanel
          ? Math.max(...lfSeries.map((d) => Math.max(Math.abs(d.cum_flow_m || 0), Math.abs(d.bar_flow_m || 0))), 0.1)
          : (hiro.length ? Math.max(...hiro.map((d) => Math.abs(d.cum_flow_m || 0))) : 0);
        const hiroUseBillions = maxBottomAbsM >= 1000;
        const hiroDiv = hiroUseBillions ? 1000.0 : 1.0;
        const hiroUnitLabel = useLiveFlowPanel
          ? (hiroUseBillions ? 'Vol Flow ($B)' : 'Vol Flow ($M)')
          : (hiroUseBillions ? 'HIRO ($B)' : 'HIRO ($M)');
        const hiroUnitTickSuffix = hiroUseBillions ? 'B' : 'M';

        if (useLiveFlowPanel) {
          const lfCustom = lfSeries.map((d) => [
            d.t,
            d.spot,
            d.call_vol || 0,
            d.put_vol || 0,
            fmtMillions(d.bar_flow_m || 0),
            fmtMillions(d.cum_flow_m || 0),
            `${(d.velocity_m || 0) >= 0 ? '+' : ''}${Number(d.velocity_m || 0).toFixed(1)}`,
            `${(d.accel_m || 0) >= 0 ? '+' : ''}${Number(d.accel_m || 0).toFixed(1)}`,
          ]);
          const lfTemplate =
            '<b>%{customdata[0]} ET</b> · Spot $%{customdata[1]:.2f}<br>' +
            'Vol: <b>%{customdata[2]:,.0f}C / %{customdata[3]:,.0f}P</b><br>' +
            '5m Impulse: <b>%{customdata[4]}</b> · Cum: <b>%{customdata[5]}</b><br>' +
            'Vel: <b>%{customdata[6]}M/5m</b> · Accel Δ²: <b>%{customdata[7]}M/5m²</b>' +
            '<extra></extra>';

          traces.push({
            type: 'bar',
            name: '5m Impulse',
            x: lfSeries.map((d) => d.min_idx),
            y: lfSeries.map((d) => Number(((d.bar_flow_m || 0) / hiroDiv).toFixed(3))),
            width: 3.6,
            xaxis: 'x3',
            yaxis: 'y3',
            marker: {
              color: lfSeries.map((d) => ((d.bar_flow_m || 0) >= 0 ? 'rgba(0, 230, 118, 0.78)' : 'rgba(255, 51, 102, 0.78)')),
              line: { width: 0 },
            },
            customdata: lfCustom,
            hovertemplate: lfTemplate,
          });
          traces.push({
            type: 'scatter',
            mode: lfSeries.length <= 2 ? 'lines+markers' : 'lines',
            name: hiroUnitLabel,
            x: lfSeries.map((d) => d.min_idx),
            y: lfSeries.map((d) => Number(((d.cum_flow_m || 0) / hiroDiv).toFixed(3))),
            xaxis: 'x3',
            yaxis: 'y3',
            line: { color: '#00F0FF', width: 2.3 },
            marker: { size: 5, color: '#00F0FF' },
            customdata: lfCustom,
            hovertemplate: lfTemplate,
          });
        } else if (hiro.length > 0) {
          traces.push({
            type: 'scatter',
            mode: 'lines',
            name: hiroUnitLabel,
            x: hiro.map((d) => d.min_idx),
            y: hiro.map((d) => Number(((d.cum_flow_m || 0) / hiroDiv).toFixed(3))),
            xaxis: 'x3',
            yaxis: 'y3',
            fill: 'tozeroy',
            fillcolor: (hiroSum.net_flow_m || 0) >= 0 ? 'rgba(0, 230, 118, 0.22)' : 'rgba(255, 51, 102, 0.22)',
            line: { color: (hiroSum.net_flow_m || 0) >= 0 ? '#00E676' : '#ff3366', width: 2.2 },
            customdata: hiro.map((d) => [d.t, d.cum_shares_k, d.price, fmtMillions(d.cum_flow_m)]),
            hovertemplate:
              '<b>%{customdata[0]} ET</b> · Spot $%{customdata[2]:.2f}<br>' +
              'Cumulative HIRO Flow: <b>%{customdata[3]}</b> (%{customdata[1]:+.1f}K shs)' +
              '<extra></extra>',
          });
        }

        const shapes = [];
        const annotations = [];

        if (showLevels && expectedMove?.range_1d?.length === 2) {
          const emLo = Math.max(yMin, Number(expectedMove.range_1d[0]));
          const emHi = Math.min(yMax, Number(expectedMove.range_1d[1]));
          if (emHi > emLo) {
            shapes.push({
              type: 'rect',
              xref: 'x2',
              yref: 'y2',
              x0: 0,
              x1: 390,
              y0: emLo,
              y1: emHi,
              fillcolor: 'rgba(0, 240, 255, 0.04)',
              line: { width: 0 },
              layer: 'above',
            });
          }
        }

        if (showLevels && Array.isArray(spotgammaTrace.air_pockets)) {
          spotgammaTrace.air_pockets.slice(0, 2).forEach((ap) => {
            const apLo = Math.max(yMin, Number(ap.low));
            const apHi = Math.min(yMax, Number(ap.high));
            if (apHi > apLo) {
              shapes.push({
                type: 'rect',
                xref: 'x2',
                yref: 'y2',
                x0: 0,
                x1: 390,
                y0: apLo,
                y1: apHi,
                fillcolor: 'rgba(168, 85, 247, 0.08)',
                line: { color: 'rgba(192, 132, 252, 0.35)', width: 1, dash: 'dot' },
                layer: 'above',
              });
            }
          });
        }

        if (showLevels) {
          const levelSpecs = buildLevelSpecs();
          const placedNormY = [];
          levelSpecs.forEach((lvl) => {
            shapes.push({
              type: 'line',
              xref: 'x2',
              yref: 'y2',
              x0: 0,
              x1: 390,
              y0: lvl.val,
              y1: lvl.val,
              line: { color: lvl.line, width: lvl.w, dash: lvl.dash },
            });
            shapes.push({
              type: 'line',
              xref: 'x domain',
              yref: 'y',
              x0: 0,
              x1: 1,
              y0: lvl.val,
              y1: lvl.val,
              line: { color: lvl.line, width: Math.max(1, lvl.w * 0.8), dash: lvl.dash },
            });

            const ny = (lvl.val - yMin) / ySpan;
            const clash = placedNormY.some((pny) => Math.abs(pny - ny) < 0.056);
            if (!clash && ny >= 0.02 && ny <= 0.98) {
              placedNormY.push(ny);
              annotations.push({
                xref: 'paper',
                x: badgeX,
                yref: 'y2',
                y: lvl.val,
                text: `<b>${lvl.label}</b>`,
                showarrow: false,
                font: {
                  color: isDarkText(lvl.bg) ? '#040812' : '#ffffff',
                  size: isNarrow ? 8.2 : 9,
                  family: 'JetBrains Mono, monospace',
                },
                bgcolor: lvl.bg,
                borderpad: 2.5,
                xanchor: 'left',
                yanchor: 'middle',
              });
            }
          });
        }

        // Candlestick-aware Signal Callout Placement Solver (avoids bars + other boxes!)
        if (showSignals && Array.isArray(spotgammaTrace.trade_signals)) {
          const sigs = spotgammaTrace.trade_signals.filter((s) => s.price >= yMin && s.price <= yMax);
          const candidateXs = [65, 130, 195, 260, 325];
          const placedSigs = [];
          const yTol = ySpan * 0.085;

          sigs.forEach((sig) => {
            const isBuy = sig.side === 'BUY' || sig.side === 'SUPPORT';
            const isSell = sig.side === 'SELL' || sig.side === 'SQUEEZE';
            const isFlip = sig.side === 'FLIP';
            const bgCol = isBuy ? 'rgba(6, 78, 59, 0.92)' : (isSell ? 'rgba(127, 29, 29, 0.92)' : (isFlip ? 'rgba(120, 53, 15, 0.92)' : 'rgba(15, 23, 42, 0.92)'));
            const brdCol = isBuy ? '#00E676' : (isSell ? '#ff3366' : (isFlip ? '#fbbf24' : '#38bdf8'));
            const normY = (sig.price - yMin) / ySpan;

            let bestX = 325;
            let bestScore = -Infinity;
            candidateXs.forEach((cx) => {
              let penalty = 0;
              // Heavy penalty for sitting right near intraday candles at that X and Y
              bars.forEach((b) => {
                if (Math.abs(b.min_idx - cx) <= 45) {
                  const dyCandle = Math.max(0, b.l - sig.price, sig.price - b.h);
                  if (dyCandle < yTol) {
                    penalty += 1000 * (1 - dyCandle / yTol);
                  }
                }
              });
              // Heavy penalty for colliding with an existing placed signal box
              placedSigs.forEach((ps) => {
                if (Math.abs(ps.ny - normY) < 0.10 && Math.abs(ps.x - cx) < 130) {
                  penalty += 800;
                }
              });
              // Slight preference for placing callouts away from tight left edge
              const score = -penalty - Math.abs(cx - 260) * 0.1;
              if (score > bestScore) {
                bestScore = score;
                bestX = cx;
              }
            });

            placedSigs.push({ x: bestX, ny: normY });
            const valPart = sig.value_m !== 0 ? ` (${sig.value_m > 0 ? '+' : ''}$${sig.value_m}M)` : '';
            const ayShift = normY > 0.72 ? 22 : -22;

            annotations.push({
              xref: 'x2',
              x: bestX,
              yref: 'y2',
              y: sig.price,
              text: `<b>${sig.short_label} · $${Number(sig.price).toFixed(0)}${valPart}</b>`,
              showarrow: true,
              arrowhead: 2,
              arrowsize: 0.75,
              arrowwidth: 1.2,
              arrowcolor: brdCol,
              ax: bestX > 220 ? -16 : 16,
              ay: ayShift,
              font: { color: '#ffffff', size: isNarrow ? 8.2 : 9, family: 'JetBrains Mono, monospace' },
              bgcolor: bgCol,
              bordercolor: brdCol,
              borderwidth: 1,
              borderpad: 3.5,
            });
          });
        }

        // Responsive Left-Bottom Desk Box (Live All-Expiry Flow OR Static HIRO Summary)
        const hNet = useLiveFlowPanel ? Number(liveOptionFlow?.net_dealer_flow_m || 0) : Number(hiroSum.net_flow_m || 0);
        const hCol = useLiveFlowPanel ? (liveOptionFlow?.phase_color || (hNet >= 0 ? '#00E676' : '#ff3366')) : (hNet >= 0 ? '#00E676' : '#ff3366');
        const ruler = spotgammaTrace.hedging_ruler || {};
        const apTxt = spotgammaTrace.air_pockets?.[0]
          ? `$${spotgammaTrace.air_pockets[0].low.toFixed(0)}–${spotgammaTrace.air_pockets[0].high.toFixed(0)}`
          : 'None near';
        const fmtCnt = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : (v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v || 0)));
        const lfVel = Number(liveOptionFlow?.velocity_m_per_5m || 0);
        const lfAcc = Number(liveOptionFlow?.accel_m_per_5m2 || 0);
        const lfPhaseShort = String(liveOptionFlow?.phase_code || 'BALANCED').replace('_', ' ');

        shapes.push({
          type: 'rect',
          xref: 'paper',
          yref: 'paper',
          x0: 0.0,
          x1: leftEnd,
          y0: 0.0,
          y1: 0.19,
          fillcolor: 'rgba(12, 18, 30, 0.94)',
          line: { color: 'rgba(56, 189, 248, 0.28)', width: 1 },
        });
        annotations.push({
          xref: 'paper',
          yref: 'paper',
          x: 0.008,
          y: 0.180,
          xanchor: 'left',
          yanchor: 'top',
          align: 'left',
          showarrow: false,
          font: { color: '#cbd5e1', size: isNarrow ? 7.8 : 8.8, family: 'JetBrains Mono, monospace' },
          text: useLiveFlowPanel
            ? (isNarrow
                ? `<b style="color:${hCol}">LIVE FLOW</b><br>` +
                  `${lfPhaseShort}<br>` +
                  `Net: <b>${fmtMillions(hNet)}</b><br>` +
                  `Vel: <b>${lfVel >= 0 ? '+' : ''}${lfVel.toFixed(0)}M</b> · Δ² <b>${lfAcc >= 0 ? '+' : ''}${lfAcc.toFixed(0)}M</b>`
                : `<b style="color:${hCol}">LIVE FLOW · ${liveOptionFlow?.expiries_active || 0} EXPS</b><br>` +
                  `State: <b style="color:${hCol}">${lfPhaseShort}</b><br>` +
                  `Net: <b>${fmtMillions(hNet)}</b> · Vol: <b>${fmtCnt(liveOptionFlow?.total_call_vol)}C/${fmtCnt(liveOptionFlow?.total_put_vol)}P</b><br>` +
                  `Vel: <b>${lfVel >= 0 ? '+' : ''}${lfVel.toFixed(1)}M/5m</b> · Δ²: <b>${lfAcc >= 0 ? '+' : ''}${lfAcc.toFixed(1)}M</b>`)
            : (isNarrow
                ? `<b style="color:#00F0FF">HIRO DESK</b><br>` +
                  `Flow: <b style="color:${hCol}">${fmtMillions(hNet)}</b><br>` +
                  `Hedge: <b>${fmtCompactShares((hiroSum.net_shares_k || 0) * 1000).replace(' shs', '')}</b><br>` +
                  `/$1: <b>${fmtCompactShares(ruler.shares_per_1_dollar || 0).replace(' shs', '')}</b> · <b style="color:#c084fc">${apTxt}</b>`
                : `<b style="color:#00F0FF">INTRADAY HIRO DESK</b><br>` +
                  `Flow: <b style="color:${hCol}">${fmtMillions(hNet)}</b><br>` +
                  `Delta: <b>${fmtCompactShares((hiroSum.net_shares_k || 0) * 1000)}</b><br>` +
                  `/$1 Move: <b>${fmtCompactShares(ruler.shares_per_1_dollar || 0)}</b><br>` +
                  `Void: <b style="color:#c084fc">${apTxt}</b>`),
        });

        const layout = {
          paper_bgcolor: '#060910',
          plot_bgcolor: '#070b14',
          margin: { l: isNarrow ? 56 : 64, r: isNarrow ? 74 : 88, t: 48, b: 42 },
          barmode: 'relative',
          hovermode: 'closest',
          dragmode: 'pan',
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
            x: 0.0,
            y: 1.075,
            xanchor: 'left',
            yanchor: 'bottom',
            font: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 9 : 10 },
            bgcolor: 'rgba(6, 9, 16, 0.75)',
          },
          xaxis: {
            domain: [0.0, leftEnd],
            anchor: 'y',
            title: { text: `${meta.short} ($M)`, font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 9.5 }, standoff: 5 },
            tickfont: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 8.5 },
            gridcolor: 'rgba(255,255,255,0.05)',
            zeroline: true,
            zerolinecolor: '#64748b',
            zerolinewidth: 1.5,
          },
          xaxis4: {
            overlaying: 'x',
            side: 'top',
            showticklabels: false,
            showgrid: false,
            zeroline: false,
          },
          yaxis: {
            domain: [0.25, 0.98],
            range: [yMin, yMax],
            tickprefix: '$',
            tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 9 : 10 },
            gridcolor: 'rgba(255,255,255,0.06)',
          },
          xaxis2: {
            domain: [centerStart, centerEnd],
            anchor: 'y2',
            range: [0, 390],
            tickvals: [0, 60, 120, 180, 240, 300, 360, 390],
            showticklabels: false,
            rangeslider: { visible: false },
            gridcolor: 'rgba(255,255,255,0.05)',
          },
          yaxis2: {
            domain: [0.25, 0.98],
            range: [yMin, yMax],
            matches: 'y',
            anchor: 'x2',
            showticklabels: false,
            gridcolor: 'rgba(255,255,255,0.05)',
          },
          xaxis3: {
            domain: [centerStart, centerEnd],
            anchor: 'y3',
            range: [0, 390],
            matches: 'x2',
            tickvals: [0, 60, 120, 180, 240, 300, 360, 390],
            ticktext: ['09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:00'],
            tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 9 },
            title: { text: `Intraday Session ET (${intro?.session_date || 'Live'}${(dataMeta?.bars_source === 'SIP+IEX_LIVE' || dataMeta?.bars_source === 'IEX_LIVE') ? ' · Live 5m Bars' : (intro?.is_synthetic ? ' · Indicative' : ' · 5m Bars')})`, font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 9.5 }, standoff: 5 },
            gridcolor: 'rgba(255,255,255,0.05)',
          },
          yaxis3: {
            domain: [0.02, 0.19],
            anchor: 'x3',
            title: { text: hiroUnitLabel, font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 8.5 }, standoff: 3 },
            ticksuffix: hiroUnitTickSuffix,
            tickfont: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 8.5 },
            gridcolor: 'rgba(255,255,255,0.05)',
            zeroline: true,
            zerolinecolor: '#64748b',
          },
        };

        window.Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: false });
        return undefined;
      }

      // =========================================================================
      // VIEW 2: FULL-WIDTH HORIZONTAL STRIKE LADDER (GEXBOT STYLE)
      // =========================================================================
      if (viewMode === 'ladder') {
        const strikesSorted = strikeRowsM.map((r) => r.strike);
        let minStep = ySpan * 0.04;
        for (let i = 1; i < strikesSorted.length; i += 1) {
          const d = strikesSorted[i] - strikesSorted[i - 1];
          if (d > 0 && d < minStep) minStep = d;
        }
        const barWidth = Math.max(ySpan * 0.012, Math.min(minStep * 0.72, ySpan * 0.045));

        const traces = [];
        if (ladderStyle === 'split') {
          traces.push({
            type: 'bar',
            orientation: 'h',
            name: `Call ${meta.short}`,
            x: strikeRowsM.map((r) => r.callM),
            y: strikeRowsM.map((r) => r.strike),
            width: barWidth,
            marker: { color: meta.posColor, opacity: 0.88 },
            hovertemplate: `Strike $%{y:.2f} · Call ${meta.short}: <b>%{x:+.2f}M</b><extra></extra>`,
          });
          traces.push({
            type: 'bar',
            orientation: 'h',
            name: `Put ${meta.short}`,
            x: strikeRowsM.map((r) => r.putM),
            y: strikeRowsM.map((r) => r.strike),
            width: barWidth,
            marker: { color: meta.negColor, opacity: 0.88 },
            hovertemplate: `Strike $%{y:.2f} · Put ${meta.short}: <b>%{x:+.2f}M</b><extra></extra>`,
          });
        } else if (ladderStyle === 'abs') {
          traces.push({
            type: 'bar',
            orientation: 'h',
            name: `Absolute ${meta.short} Concentration`,
            x: strikeRowsM.map((r) => r.absM),
            y: strikeRowsM.map((r) => r.strike),
            width: barWidth,
            marker: {
              color: strikeRowsM.map((r) => (Math.abs(r.strike - (scopeData?.key_gamma_strike || -1)) < 0.05 ? '#fbbf24' : '#38bdf8')),
              opacity: 0.9,
            },
            hovertemplate: `Strike $%{y:.2f} · Total Abs ${meta.short}: <b>$%{x:.2f}M</b><extra></extra>`,
          });
        } else {
          traces.push({
            type: 'bar',
            orientation: 'h',
            name: `${source === 'vol' ? 'Vol' : 'OI'} Net ${meta.short}`,
            x: strikeRowsM.map((r) => r.netM),
            y: strikeRowsM.map((r) => r.strike),
            width: barWidth,
            marker: {
              color: strikeRowsM.map((r) => (r.netM >= 0 ? meta.posColor : meta.negColor)),
              opacity: 0.92,
            },
            customdata: strikeRowsM.map((r) => [r.pct, r.callM, r.putM, r.absM]),
            hovertemplate:
              '<b>Strike $%{y:.2f}</b> (%{customdata[0]:+.1f}%)<br>' +
              `Net ${meta.short}: <b>%{x:+.2f}M</b> · Call %{customdata[1]:+.2f}M · Put %{customdata[2]:+.2f}M<extra></extra>`,
          });
          const sdePairs = (ivStressResolved.prices || [])
            .map((p, idx) => ({ p, v: ivStressResolved.curveM[idx] }))
            .filter((pt) => pt.p >= yMin && pt.p <= yMax);
          if (sdePairs.length >= 2) {
            traces.push({
              type: 'scatter',
              mode: 'lines',
              name: `Portfolio SDE Curve${ivShift !== 0 ? ` (${ivShift > 0 ? '+' : ''}${ivShift}% IV)` : ''}`,
              x: sdePairs.map((pt) => pt.v),
              y: sdePairs.map((pt) => pt.p),
              xaxis: 'x2',
              line: { color: '#00F0FF', width: 3 },
              hovertemplate: `Portfolio SDE (${meta.short}): <b>%{x:+.2f}M</b> @ $%{y:.2f}<extra></extra>`,
            });
          }
        }

        const shapes = [];
        const annotations = [];
        if (showLevels) {
          const placedNormY = [];
          buildLevelSpecs().forEach((lvl) => {
            shapes.push({
              type: 'line',
              xref: 'paper',
              yref: 'y',
              x0: 0,
              x1: 1,
              y0: lvl.val,
              y1: lvl.val,
              line: { color: lvl.line, width: lvl.w, dash: lvl.dash },
            });
            const ny = (lvl.val - yMin) / ySpan;
            if (!placedNormY.some((pny) => Math.abs(pny - ny) < 0.056)) {
              placedNormY.push(ny);
              annotations.push({
                xref: 'paper',
                x: 1.006,
                yref: 'y',
                y: lvl.val,
                text: `<b>${lvl.label}</b>`,
                showarrow: false,
                font: { color: isDarkText(lvl.bg) ? '#040812' : '#ffffff', size: 9, family: 'JetBrains Mono, monospace' },
                bgcolor: lvl.bg,
                borderpad: 2.5,
                xanchor: 'left',
              });
            }
          });
        }

        const layout = {
          paper_bgcolor: '#060910',
          plot_bgcolor: '#070b14',
          margin: { l: 70, r: 92, t: 50, b: 48 },
          barmode: 'relative',
          shapes,
          annotations,
          showlegend: true,
          legend: {
            orientation: 'h',
            x: 0,
            y: 1.07,
            font: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 10 },
            bgcolor: 'rgba(6,9,16,0.75)',
          },
          xaxis: {
            title: { text: `Strike ${meta.short} ($M · ${source === 'vol' ? 'Active Volume' : 'Open Interest'})`, font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 10 } },
            tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 10 },
            gridcolor: 'rgba(255,255,255,0.06)',
            zeroline: true,
            zerolinecolor: '#64748b',
            zerolinewidth: 1.5,
          },
          xaxis2: {
            overlaying: 'x',
            side: 'top',
            showticklabels: false,
            showgrid: false,
            zeroline: false,
          },
          yaxis: {
            title: { text: 'Strike Price ($)', font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 10 } },
            range: [yMin, yMax],
            tickprefix: '$',
            tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 10 },
            gridcolor: 'rgba(255,255,255,0.06)',
          },
        };

        window.Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: false });
        return undefined;
      }

      // =========================================================================
      // VIEW 3: CONTINUOUS SDE CONVEXITY + IV STRESS FAN LAB
      // =========================================================================
      const prices = ivStressResolved.prices || [];
      const curveM = ivStressResolved.curveM || [];
      const traces = [];
      const iscShifts = spotgammaTrace?.iv_stress_curves?.shifts;
      const lensField = lens === 'gex' ? 'net_gex_m' : (lens === 'dex' ? 'net_dex_m' : (lens === 'cex' ? 'net_cex_m' : 'net_vex_m'));

      if (scope === 'all' && iscShifts && prices.length > 0) {
        const fanMeta = [
          { key: '-6', name: '-6% IV Crush', color: 'rgba(0, 230, 118, 0.5)', dash: 'dot' },
          { key: '-3', name: '-3% IV Crush', color: 'rgba(52, 211, 153, 0.72)', dash: 'dash' },
          { key: '3', name: '+3% IV Spike', color: 'rgba(251, 113, 133, 0.72)', dash: 'dash' },
          { key: '6', name: '+6% IV Spike', color: 'rgba(244, 63, 94, 0.5)', dash: 'dot' },
        ];
        fanMeta.forEach((fm) => {
          const arr = iscShifts[fm.key]?.[lensField];
          if (Array.isArray(arr) && arr.length === prices.length) {
            traces.push({
              type: 'scatter',
              mode: 'lines',
              name: fm.name,
              x: prices,
              y: arr,
              line: { color: fm.color, width: 1.6, dash: fm.dash },
              hovertemplate: `${fm.name} @ $%{x:.2f}: <b>%{y:+.2f}M</b><extra></extra>`,
            });
          }
        });
      }

      traces.push({
        type: 'scatter',
        mode: 'lines',
        name: `Active SDE Curve${ivShift !== 0 ? ` (${ivShift > 0 ? '+' : ''}${ivShift}% IV)` : ' (Live IV)'}`,
        x: prices,
        y: curveM,
        fill: 'tozeroy',
        fillcolor: ivStressResolved.spotM >= 0 ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 51, 102, 0.12)',
        line: { color: '#00F0FF', width: 3.2 },
        hovertemplate: `Spot $%{x:.2f} · Portfolio ${meta.short}: <b>%{y:+.2f}M</b><extra></extra>`,
      });

      const shapes = [];
      const annotations = [];
      const placedCurveAnns = [];
      const xSpanCurve = prices.length ? Math.max(1e-6, Math.max(...prices) - Math.min(...prices)) : 1;
      const pMinCurve = prices.length ? Math.min(...prices) : 0;
      const pMaxCurve = prices.length ? Math.max(...prices) : 1;

      const addVLine = (xVal, label, col, dash = 'dash') => {
        if (!xVal || !prices.length) return;
        if (xVal < pMinCurve || xVal > pMaxCurve) return;
        shapes.push({
          type: 'line',
          xref: 'x',
          yref: 'paper',
          x0: xVal,
          x1: xVal,
          y0: 0,
          y1: 1,
          line: { color: col, width: 2, dash },
        });
        const nx = (xVal - pMinCurve) / xSpanCurve;
        let rowSlot = 0;
        if (placedCurveAnns.some((pa) => Math.abs(pa.nx - nx) < 0.14 && pa.slot === 0)) {
          rowSlot = 1;
        }
        if (placedCurveAnns.some((pa) => Math.abs(pa.nx - nx) < 0.14 && pa.slot === rowSlot)) {
          rowSlot = 2;
        }
        placedCurveAnns.push({ nx, slot: rowSlot });
        annotations.push({
          xref: 'x',
          yref: 'paper',
          x: xVal,
          y: 0.975,
          text: `<b>${label}</b>`,
          showarrow: false,
          yanchor: 'top',
          font: { color: isDarkText(col) ? '#040812' : '#ffffff', size: 9, family: 'JetBrains Mono, monospace' },
          bgcolor: col,
          borderpad: 2.5,
          yshift: -(rowSlot * 21),
        });
      };

      if (showLevels) {
        addVLine(spotVal, `SPOT $${spotVal.toFixed(1)}`, '#ffffff', 'dash');
        if (ivStressResolved.zeroGamma) addVLine(ivStressResolved.zeroGamma, `FLIP $${ivStressResolved.zeroGamma.toFixed(1)}`, '#fbbf24', 'dashdot');
        if (scopeData?.call_wall) addVLine(scopeData.call_wall, `CW $${Number(scopeData.call_wall).toFixed(0)}`, '#00E676', 'dot');
        if (scopeData?.put_wall) addVLine(scopeData.put_wall, `PW $${Number(scopeData.put_wall).toFixed(0)}`, '#ff3366', 'dot');

        if (expectedMove?.range_1d?.length === 2) {
          shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: Number(expectedMove.range_1d[0]),
            x1: Number(expectedMove.range_1d[1]),
            y0: 0,
            y1: 1,
            fillcolor: 'rgba(0, 240, 255, 0.05)',
            line: { width: 0 },
          });
        }
      }

      const layout = {
        paper_bgcolor: '#060910',
        plot_bgcolor: '#070b14',
        margin: { l: 72, r: 34, t: 48, b: 48 },
        shapes,
        annotations,
        showlegend: true,
        legend: {
          orientation: 'h',
          x: 0,
          y: 1.08,
          font: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 10 },
          bgcolor: 'rgba(6,9,16,0.75)',
        },
        xaxis: {
          title: { text: `Simulated Price Spectrum ($ · ${scopeData?.expiry_label || 'All Chain'})`, font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 10 } },
          tickprefix: '$',
          tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 10 },
          gridcolor: 'rgba(255,255,255,0.06)',
        },
        yaxis: {
          title: { text: `Portfolio ${meta.short} ($M)`, font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 10 } },
          tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 10 },
          gridcolor: 'rgba(255,255,255,0.06)',
          zeroline: true,
          zerolinecolor: '#64748b',
          zerolinewidth: 1.5,
        },
      };

      window.Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: false });
    } catch (err) {
      console.warn('SpotGamma TRACE Plotly render error:', err);
    }

    return undefined;
  }, [
    plotlyReady,
    plotWidth,
    spotgammaTrace,
    spotVal,
    ticker,
    viewMode,
    lens,
    scope,
    source,
    fieldMode,
    priceStyle,
    smoothMode,
    ladderStyle,
    showLevels,
    showSignals,
    ivShift,
    yBounds,
    strikeRowsM,
    scopeData,
    ivStressResolved,
    expectedMove,
    meta,
    liveOptionFlow,
    dataMeta,
    flowPanelMode,
  ]);

  if (!spotgammaTrace) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontFamily: 'monospace' }}>
        Initializing SpotGamma TRACE Studio v3.0...
      </div>
    );
  }

  const spotValM = ivStressResolved.spotM;
  const isSpotPos = spotValM >= 0;
  const zgVal = ivStressResolved.zeroGamma;
  const zgDistPct = zgVal && spotVal ? (((spotVal - zgVal) / spotVal) * 100).toFixed(1) : null;
  const ruler = spotgammaTrace.hedging_ruler || {};
  const scopeShares1d = scopeData?.shares_per_dollar_move || ruler.shares_per_1_dollar || 0;
  const scopeDollars1dM = (scopeData?.dollars_per_dollar_move || 0) / 1e6;
  const scopeTag = scope === 'all' ? 'All Chain' : (scope === 'weekly' ? 'Weekly ≤7D' : 'Front Exp');

  return (
    <div className="sg-trace-shell">
      {/* ================================================================= */}
      {/* ULTRA-COMPACT 2-ROW COMMAND BAR (STRICT 2 ROWS ON 1000px+ DESKTOP) */}
      {/* ================================================================= */}
      <div className="sg-trace-cmdbar">
        <div className="sg-trace-cmd-row">
          <div className="sg-trace-pill-group">
            <button type="button" onClick={() => setViewMode('studio')} className={`sg-trace-btn ${viewMode === 'studio' ? 'active cyan' : ''}`}>
              <Flame size={11} /> Studio
            </button>
            <button type="button" onClick={() => setViewMode('ladder')} className={`sg-trace-btn ${viewMode === 'ladder' ? 'active cyan' : ''}`}>
              <Layers size={11} /> Ladder
            </button>
            <button type="button" onClick={() => setViewMode('curve')} className={`sg-trace-btn ${viewMode === 'curve' ? 'active cyan' : ''}`}>
              <Activity size={11} /> Curve
            </button>
          </div>

          <div className="sg-trace-pill-group">
            {Object.entries(LENS_META).map(([k, m]) => (
              <button
                key={k}
                type="button"
                onClick={() => setLens(k)}
                className={`sg-trace-btn ${lens === k ? `active lens-${k}` : ''}`}
              >
                {m.short}
              </button>
            ))}
          </div>

          <div className="sg-trace-pill-group">
            <button type="button" onClick={() => setScope('all')} className={`sg-trace-btn ${scope === 'all' ? 'active' : ''}`}>All</button>
            <button type="button" onClick={() => setScope('weekly')} className={`sg-trace-btn ${scope === 'weekly' ? 'active' : ''}`}>≤7D</button>
            <button type="button" onClick={() => setScope('front')} className={`sg-trace-btn ${scope === 'front' ? 'active' : ''}`}>0DTE</button>
          </div>

          <div className="sg-trace-pill-group">
            <button type="button" onClick={() => setSource('oi')} className={`sg-trace-btn ${source === 'oi' ? 'active emerald' : ''}`} title="Open Interest Walls">🏛️ OI</button>
            <button type="button" onClick={() => setSource('vol')} className={`sg-trace-btn ${source === 'vol' ? 'active emerald' : ''}`} title="Today's Active Volume">⚡ Vol</button>
          </div>

          <div className="sg-trace-pill-group" style={{ marginLeft: 'auto' }}>
            <button type="button" onClick={handleExportPng} className="sg-trace-btn compact" title="Export High-Res PNG">
              <Camera size={11} /> PNG
            </button>
            <button type="button" onClick={() => setShowGuide((v) => !v)} className={`sg-trace-btn compact ${showGuide ? 'active cyan' : ''}`}>
              <Info size={11} /> Guide {showGuide ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          </div>
        </div>

        {/* Row 2 */}
        <div className="sg-trace-cmd-row secondary">
          <div className="sg-trace-pill-group">
            {[
              { id: 'smart', lbl: 'Smart' },
              { id: '5', lbl: '±5%' },
              { id: '8', lbl: '±8%' },
              { id: '12', lbl: '±12%' },
            ].map((z) => (
              <button key={z.id} type="button" onClick={() => setZoomMode(z.id)} className={`sg-trace-btn compact ${zoomMode === z.id ? 'active' : ''}`}>
                {z.lbl}
              </button>
            ))}
          </div>

          {viewMode === 'studio' && (
            <>
              <div className="sg-trace-pill-group">
                <button type="button" onClick={() => setFieldMode('liquidity')} className={`sg-trace-btn compact ${fieldMode === 'liquidity' ? 'active' : ''}`}>💧 Liq</button>
                <button type="button" onClick={() => setFieldMode('regime')} className={`sg-trace-btn compact ${fieldMode === 'regime' ? 'active' : ''}`}>🌊 Regime</button>
              </div>
              <div className="sg-trace-pill-group">
                <button type="button" onClick={() => setPriceStyle(priceStyle === 'candles' ? 'line' : 'candles')} className="sg-trace-btn compact active" title="Toggle Candles vs Line+VWAP">
                  {priceStyle === 'candles' ? '🕯️ Candles' : '📈 Line'}
                </button>
                <button type="button" onClick={() => setSmoothMode(smoothMode === 'smooth' ? 'discrete' : 'smooth')} className={`sg-trace-btn compact ${smoothMode === 'smooth' ? 'active' : ''}`}>
                  {smoothMode === 'smooth' ? 'Fluid' : 'Grid'}
                </button>
                <button type="button" onClick={() => setShowSignals((v) => !v)} className={`sg-trace-btn compact ${showSignals ? 'active emerald' : ''}`}>🎯 Sig</button>
                <button type="button" onClick={() => setShowLevels((v) => !v)} className={`sg-trace-btn compact ${showLevels ? 'active' : ''}`}>📏 Levels</button>
              </div>
              {liveOptionFlow?.flow_series?.length > 0 && (
                <div className="sg-trace-pill-group">
                  <button
                    type="button"
                    onClick={() => setFlowPanelMode('live_flow')}
                    className={`sg-trace-btn compact ${flowPanelMode === 'live_flow' ? 'active cyan' : ''}`}
                    title="Intraday Signed All-Expiry Volume Flow & Acceleration"
                  >
                    ⚡ Live Vol Flow
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlowPanelMode('oi_hiro')}
                    className={`sg-trace-btn compact ${flowPanelMode === 'oi_hiro' ? 'active' : ''}`}
                    title="Static Open Interest HIRO Path Impulse"
                  >
                    🏛️ OI HIRO
                  </button>
                </div>
              )}
            </>
          )}

          {viewMode === 'ladder' && (
            <div className="sg-trace-pill-group">
              <button type="button" onClick={() => setLadderStyle('net_curve')} className={`sg-trace-btn compact ${ladderStyle === 'net_curve' ? 'active' : ''}`}>⚡ Net+Curve</button>
              <button type="button" onClick={() => setLadderStyle('split')} className={`sg-trace-btn compact ${ladderStyle === 'split' ? 'active' : ''}`}>📊 Call/Put</button>
              <button type="button" onClick={() => setLadderStyle('abs')} className={`sg-trace-btn compact ${ladderStyle === 'abs' ? 'active' : ''}`}>🧲 Abs Pin</button>
              <button type="button" onClick={() => setShowLevels((v) => !v)} className={`sg-trace-btn compact ${showLevels ? 'active' : ''}`}>📏 Levels</button>
            </div>
          )}

          {viewMode === 'curve' && (
            <div className="sg-trace-pill-group">
              <button type="button" onClick={() => setShowLevels((v) => !v)} className={`sg-trace-btn compact ${showLevels ? 'active' : ''}`}>📏 1σ/Levels</button>
            </div>
          )}

          <div className="sg-trace-slider-wrap" style={{ marginLeft: 'auto' }} title="Stress-test Implied Volatility shift (-6% to +6%)">
            <span className="sg-trace-group-lbl">ΔIV</span>
            <input
              type="range"
              min={-6}
              max={6}
              step={1}
              value={ivShift}
              onChange={(e) => setIvShift(Number(e.target.value))}
              className="sg-trace-slider"
              aria-label="Implied Volatility Stress Shift"
            />
            <span className={`sg-trace-iv-badge ${ivShift < 0 ? 'crush' : (ivShift > 0 ? 'spike' : 'live')}`}>
              {ivShift === 0 ? `Live ${spotgammaTrace.atm_iv_pct || 25}%` : `${ivShift > 0 ? '+' : ''}${ivShift}% IV`}
            </span>
            {ivShift !== 0 && (
              <button type="button" onClick={() => setIvShift(0)} className="sg-trace-reset-btn" title="Reset ΔIV to Live">
                <RotateCcw size={10} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* CRISP ZERO-ELLIPSIS 6-TILE TELEMETRY RIBBON                       */}
      {/* ================================================================= */}
      <div className="sg-trace-telemetry">
        <div className="sg-tel-tile" style={{ borderLeft: `3px solid ${isSpotPos ? meta.posColor : meta.negColor}` }}>
          <span className="sg-tel-lbl">SPOT {meta.short} · {scopeTag}</span>
          <strong className="sg-tel-val" style={{ color: isSpotPos ? meta.posColor : meta.negColor }}>
            {fmtMillions(spotValM)}
          </strong>
          <span className="sg-tel-sub">
            {isSpotPos ? '🟢 Pin / Dampen' : '🔴 Trend / Accel'}
          </span>
        </div>

        <div className="sg-tel-tile" style={{ borderLeft: '3px solid #fbbf24' }}>
          <span className="sg-tel-lbl">VOL TRIGGER (FLIP)</span>
          <strong className="sg-tel-val" style={{ color: '#fbbf24' }}>
            {zgVal ? `$${Number(zgVal).toFixed(2)}` : 'No Flip ±22%'}
          </strong>
          <span className="sg-tel-sub">
            {zgDistPct !== null
              ? `${Number(zgDistPct) >= 0 ? '▲ +' : '▼ '}${zgDistPct}% vs Flip`
              : (isSpotPos ? 'Deep Long Gamma' : 'Deep Short Gamma')}
          </span>
        </div>

        <div className="sg-tel-tile">
          <span className="sg-tel-lbl">WALL CORRIDOR</span>
          <strong className="sg-tel-val">
            <span style={{ color: '#00E676' }}>CW ${scopeData?.call_wall || '--'}</span>
            <span style={{ color: '#475569', margin: '0 4px' }}>/</span>
            <span style={{ color: '#ff3366' }}>PW ${scopeData?.put_wall || '--'}</span>
          </strong>
          <span className="sg-tel-sub">
            Spot ${spotVal.toFixed(2)} ({yBounds[0].toFixed(0)}–{yBounds[1].toFixed(0)})
          </span>
        </div>

        <div className="sg-tel-tile">
          <span className="sg-tel-lbl">KEY GAMMA PIN</span>
          <strong className="sg-tel-val" style={{ color: '#38bdf8' }}>
            ${scopeData?.key_gamma_strike || '--'} · {fmtRawDollars(scopeData?.key_gamma_abs || 0).replace('+', '')}
          </strong>
          <span className="sg-tel-sub">
            Net: {fmtRawDollars(scopeData?.key_gamma_net || 0)}
          </span>
        </div>

        <div className="sg-tel-tile">
          <span className="sg-tel-lbl">1D MOVE (±1σ)</span>
          <strong className="sg-tel-val" style={{ color: '#00F0FF' }}>
            {expectedMove?.range_1d ? `$${Number(expectedMove.range_1d[0]).toFixed(1)}–$${Number(expectedMove.range_1d[1]).toFixed(1)}` : '---'}
          </strong>
          <span className="sg-tel-sub">
            ±{expectedMove?.move_1d_pct || 0}% · IV {Math.round(spotgammaTrace.atm_iv_pct || expectedMove?.atm_iv_pct || 25)}%
          </span>
        </div>

        <div className="sg-tel-tile">
          <span className="sg-tel-lbl">HEDGE VELOCITY</span>
          <strong className="sg-tel-val" style={{ color: '#cbd5e1' }}>
            {fmtCompactShares(scopeShares1d)}/$1
          </strong>
          <span className="sg-tel-sub">
            {fmtMillions(scopeDollars1dM).replace('+', '')}/$1 · {fmtCompactShares(scopeData?.shares_per_1pct_move || ruler.shares_per_1pct || 0).replace(' shs', '')}/1%
          </span>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SYNCHRONIZED PLOTLY CANVAS                                        */}
      {/* ================================================================= */}
      <div className="sg-trace-canvas-wrap">
        {!plotlyReady && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontFamily: 'monospace' }}>
            Loading institutional TRACE Plotly engine...
          </div>
        )}
        <div
          ref={plotRef}
          style={{ width: '100%', height: viewMode === 'studio' ? '565px' : '495px', borderRadius: '10px', overflow: 'hidden' }}
        />
        <div className="sg-trace-micro-legend">
          <span><b style={{ color: '#00E676' }}>EMERALD</b> Long Gamma / Dip Support</span>
          <span><b style={{ color: '#ff3366' }}>CRIMSON</b> Short Gamma / Supply</span>
          <span><b style={{ color: '#00F0FF' }}>CYAN CURVE</b> SDE Exposure · ±1σ Band</span>
          <span><b style={{ color: '#fbbf24' }}>GOLD DASH</b> Session VWAP & Flip</span>
          <span><b style={{ color: '#c084fc' }}>VIOLET ZONE</b> Low-Liquidity Air Pocket</span>
        </div>
      </div>

      {/* ================================================================= */}
      {/* BALANCED 3-COLUMN DEALER SCENARIO PLAYBOOK                        */}
      {/* ================================================================= */}
      {scenarios && (
        <div className="sg-trace-playbook-grid">
          <div className={`sg-scen-card ${scenarios.down.valM >= 0 ? 'pos' : 'neg'}`}>
            <div className="sg-scen-top">
              <span>📉 IF SPOT DROPS -2% (${scenarios.down.price.toFixed(2)})</span>
              <span className="sg-scen-tag">{scenarios.down.valM >= 0 ? 'SUPPORTIVE' : 'ACCELERATING'}</span>
            </div>
            <div className="sg-scen-main" style={{ color: scenarios.down.valM >= 0 ? '#00E676' : '#ff3366' }}>
              {scenarios.down.valM >= 0 ? 'Dealers BUY Dips (Liquidity Cushion)' : 'Dealers SELL Drops (Liquidation Risk)'}
            </div>
            <div className="sg-scen-sub">
              Simulated {meta.short}: <strong>{fmtMillions(scenarios.down.valM)}</strong> · Floor PW <strong>${scopeData?.put_wall || keyLevels?.put_wall}</strong>
            </div>
          </div>

          <div className={`sg-scen-card ${scenarios.cur.valM >= 0 ? 'cyan' : 'neg'}`}>
            <div className="sg-scen-top">
              <span>🎯 AT CURRENT SPOT (${spotVal.toFixed(2)})</span>
              <span className="sg-scen-tag">{ivShift !== 0 ? `SIM ${ivShift > 0 ? '+' : ''}${ivShift}% IV` : 'LIVE BOOK'}</span>
            </div>
            <div className="sg-scen-main" style={{ color: scenarios.cur.valM >= 0 ? '#00F0FF' : '#ff3366' }}>
              {scenarios.cur.valM >= 0 ? 'Mean-Reverting Range / Pinning Flow' : 'Expanding Range / Trend Continuation'}
            </div>
            <div className="sg-scen-sub">
              Flip: <strong>{zgVal ? `$${Number(zgVal).toFixed(1)}` : 'No Flip ±22%'}</strong> ·{' '}
              {flowPanelMode === 'live_flow' && liveOptionFlow?.total_vol > 0
                ? <>Live Vol Flow: <strong>{fmtMillions(liveOptionFlow.net_dealer_flow_m || 0)}</strong></>
                : <>HIRO Today: <strong>{fmtMillions(spotgammaTrace.hiro_summary?.net_flow_m || 0)}</strong></>}
            </div>
          </div>

          <div className={`sg-scen-card ${scenarios.up.valM >= 0 ? 'amber' : 'cyan'}`}>
            <div className="sg-scen-top">
              <span>📈 IF SPOT RALLIES +2% (${scenarios.up.price.toFixed(2)})</span>
              <span className="sg-scen-tag">{scenarios.up.valM >= 0 ? 'SUPPLY CAP' : 'SQUEEZE FUEL'}</span>
            </div>
            <div className="sg-scen-main" style={{ color: scenarios.up.valM >= 0 ? '#fbbf24' : '#38bdf8' }}>
              {scenarios.up.valM >= 0 ? 'Dealers SELL Rallies Into Call Wall' : 'Dealers BUY Rallies (Short-Cover Fuel)'}
            </div>
            <div className="sg-scen-sub">
              Simulated {meta.short}: <strong>{fmtMillions(scenarios.up.valM)}</strong> · Ceiling CW <strong>${scopeData?.call_wall || keyLevels?.call_wall}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* COLLAPSIBLE GUIDE (DEFAULT CLOSED, ZERO RAW LATEX)                */}
      {/* ================================================================= */}
      {showGuide && (
        <div className="gex-trace-guide-card" style={{ margin: 0 }}>
          <div className="guide-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={14} color="#00F0FF" />
              <strong style={{ color: '#ffffff', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                SpotGamma TRACE Studio v3.0 · Institutional Reading Guide
              </strong>
            </div>
            <span className="guide-badge-pill">SYNCHRONIZED DEALER LIQUIDITY + HIRO ENGINE</span>
          </div>
          <div className="guide-cols-3">
            <div className="guide-col">
              <strong style={{ color: '#00F0FF' }}>1. Synced Strike Ladder (Left)</strong>
              <p>
                Shares the exact Price Y-axis with the intraday map. Toggle between Open Interest structural walls (🏛️ OI) and live intraday contract flow (⚡ Vol) across All, Weekly ≤7D, and Front/0DTE chains.
              </p>
            </div>
            <div className="guide-col">
              <strong style={{ color: '#00E676' }}>2. Price × Time Field (Center)</strong>
              <p>
                Overlays 5m live candlesticks + VWAP directly onto intraday evolving dealer gamma/charm bands (09:30 → 16:00 ET). Violet zones isolate low-liquidity Air Pockets where price accelerates fast.
              </p>
            </div>
            <div className="guide-col">
              <strong style={{ color: '#c084fc' }}>3. HIRO Impulse & ΔIV Stress</strong>
              <p>
                Bottom HIRO ribbon tracks cumulative dollar &amp; share hedging forced across today&apos;s price path. Drag ΔIV (-6% to +6%) to stress-test Vanna shifts on the portfolio Volatility Trigger.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
