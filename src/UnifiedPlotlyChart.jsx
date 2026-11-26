import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Loader, Maximize2, Minimize2, Search } from 'lucide-react';

const QUICK_FS_TICKERS = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'META', 'PLTR', 'AMD', 'AVGO', 'HOOD', 'SMH'];

const TIMEFRAME_PRESETS = [
  { id: '15M_5D', label: '15m · 5D', timeframe: '15M', range: '5D' },
  { id: '1H_1M', label: '1H · 1M', timeframe: '1H', range: '1M' },
  { id: '1D_3M', label: '1D · 3M', timeframe: '1D', range: '3M' },
  { id: '1D_6M', label: '1D · 6M', timeframe: '1D', range: '6M' },
  { id: '1D_1Y', label: '1D · 1Y', timeframe: '1D', range: '1Y' },
  { id: '1D_2Y', label: '1D · 2Y', timeframe: '1D', range: '2Y' },
  { id: '1W_3Y', label: '1W · 3Y', timeframe: '1W', range: '3Y' },
  { id: '1W_5Y', label: '1W · 5Y', timeframe: '1W', range: '5Y' },
];

const OSCILLATOR_MODES = [
  { id: 'ttm_squeeze', label: '🔥 TTM Sqz' },
  { id: 'macd', label: '🌊 MACD' },
  { id: 'rsi', label: '⚡ RSI (14)' },
  { id: 'adx', label: '🧭 ADX (±DI)' },
];

function resolveAnnotationCollisions(annList, yMin, yMax, isLog = false) {
  if (!annList.length || !Number.isFinite(yMin) || !Number.isFinite(yMax) || yMax <= yMin) {
    return annList;
  }
  const toCoord = (v) => (isLog && v > 0 ? Math.log10(v) : v);
  const cMin = toCoord(Math.max(0.01, yMin));
  const cMax = toCoord(Math.max(0.02, yMax));
  const cSpan = cMax - cMin;
  if (!Number.isFinite(cSpan) || cSpan <= 0) return annList;

  // Enforce >= 7.2% pane-height separation (~27px on 376px price pane) via bidirectional pass
  const minGap = cSpan * 0.072;

  const sortGroup = (items) => {
    if (!items.length) return [];
    const sorted = items
      .map((a) => ({ ...a, _c: toCoord(a.y) }))
      .sort((a, b) => a._c - b._c);

    // Forward pass: push colliding annotations upward
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i]._c - sorted[i - 1]._c < minGap) {
        sorted[i]._c = sorted[i - 1]._c + minGap;
      }
    }
    // Backward pass: clamp to top bound and resolve downward without ever collapsing two labels
    const topCap = cMax - cSpan * 0.025;
    if (sorted[sorted.length - 1]._c > topCap) {
      sorted[sorted.length - 1]._c = topCap;
    }
    for (let i = sorted.length - 2; i >= 0; i -= 1) {
      if (sorted[i + 1]._c - sorted[i]._c < minGap) {
        sorted[i]._c = sorted[i + 1]._c - minGap;
      }
    }
    return sorted.map(({ _c, ...rest }) => ({ ...rest, y: _c }));
  };

  const left = sortGroup(annList.filter((a) => a.xanchor === 'left' && Number(a.x) < 0.25));
  const center = sortGroup(annList.filter((a) => Number(a.x) >= 0.25 && Number(a.x) < 0.78));
  const right = sortGroup(annList.filter((a) => Number(a.x) >= 0.78 || (a.xanchor === 'right' && Number(a.x) >= 0.78)));
  return [...left, ...center, ...right];
}

export default function UnifiedPlotlyChart({
  ticker,
  onChartDataLoaded,
  onSelectTicker,
  externalPaneLayout,
  onPaneLayoutChange,
  externalFullscreen,
  onToggleFullscreen,
  showFullChartButton = false,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartPayload, setChartPayload] = useState(null);
  const [tfPreset, setTfPreset] = useState('1D_1Y');
  const [oscMode, setOscMode] = useState('ttm_squeeze');
  const [logScale, setLogScale] = useState(false);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [internalPaneLayout, setInternalPaneLayout] = useState('4pane');
  const [hoveredBar, setHoveredBar] = useState(null);
  const [fsSearchInput, setFsSearchInput] = useState('');
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 900
  );

  const isFullscreen = externalFullscreen !== undefined ? externalFullscreen : internalFullscreen;
  const paneLayout = externalPaneLayout !== undefined ? externalPaneLayout : internalPaneLayout;
  const isFullPriceOnly = paneLayout === 'full_price';

  const handleToggleFullscreen = () => {
    if (typeof onToggleFullscreen === 'function') {
      onToggleFullscreen(!isFullscreen);
    } else {
      setInternalFullscreen((f) => !f);
    }
  };

  const handleSetPaneLayout = (mode) => {
    if (typeof onPaneLayoutChange === 'function') {
      onPaneLayoutChange(mode);
    } else {
      setInternalPaneLayout(mode);
    }
  };

  const [overlays, setOverlays] = useState({
    maRibbon: true,
    emaCloud: true,
    marketsurgePattern: true,
    volumeProfile: true,
    gexWalls: true,
    vcpAndFootprints: true,
    tradePlanZones: false,
    bollinger: false,
  });

  const plotRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const lastHoveredTimeRef = useRef(null);
  const hoverRafRef = useRef(null);
  const fetchAbortRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        if (typeof onToggleFullscreen === 'function') {
          onToggleFullscreen(false);
        } else {
          setInternalFullscreen(false);
        }
      }
    };
    const triggerPlotResize = () => {
      if (plotRef.current && window.Plotly && plotRef.current.offsetParent !== null) {
        try {
          window.Plotly.Plots.resize(plotRef.current);
        } catch (_) {}
      }
    };
    const onResize = () => {
      setViewportHeight(window.innerHeight);
      triggerPlotResize();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && canvasWrapRef.current) {
      ro = new ResizeObserver(() => {
        requestAnimationFrame(triggerPlotResize);
      });
      ro.observe(canvasWrapRef.current);
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
    };
  }, [isFullscreen, onToggleFullscreen]);

  const toggleOverlay = (key) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activePresetObj = useMemo(
    () => TIMEFRAME_PRESETS.find((p) => p.id === tfPreset) || TIMEFRAME_PRESETS[4],
    [tfPreset]
  );

  const fetchChartData = useCallback(async () => {
    if (!ticker) return;
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const url = `/api/chart_data?ticker=${encodeURIComponent(ticker)}&timeframe=${activePresetObj.timeframe}&range=${activePresetObj.range}`;
      const res = await fetch(url, { signal: controller.signal });
      const rawText = await res.text();
      if (!res.ok) {
        let errMsg = `Backend HTTP ${res.status}`;
        try {
          const parsedErr = JSON.parse(rawText);
          if (parsedErr.error) errMsg = parsedErr.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      const safeText = rawText
        .replace(/:\s*NaN\b/g, ': null')
        .replace(/:\s*Infinity\b/g, ': null')
        .replace(/:\s*-Infinity\b/g, ': null');
      const data = JSON.parse(safeText);
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      if (!data.candles || !Array.isArray(data.candles) || data.candles.length === 0) {
        throw new Error('Invalid API response: missing candles array');
      }
      setChartPayload(data);
      setHoveredBar(data.candles[data.candles.length - 1]);
      if (typeof onChartDataLoaded === 'function') {
        onChartDataLoaded(data);
      }
      setLoading(false);
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      setError(err.message || String(err));
      setLoading(false);
    }
  }, [ticker, activePresetObj.timeframe, activePresetObj.range]);

  useEffect(() => {
    fetchChartData();
    return () => {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
    };
  }, [fetchChartData]);

  // Build Synchronized 4-Pane Plotly Traces & Layout (with collision-free annotations & compact inline legend)
  useEffect(() => {
    if (!chartPayload || !chartPayload.candles || !plotRef.current) return;

    const data = chartPayload;
    const candles = data.candles;
    const dates = candles.map((c) => c.time);
    const opens = candles.map((c) => c.open);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const closes = candles.map((c) => c.close);
    const vols = candles.map((c) => c.value || 0);
    const volSma50 = candles.map((c) => c.vol_sma50 || 0);

    const priceMin = Math.min(...lows.filter((v) => Number.isFinite(v)));
    const priceMax = Math.max(...highs.filter((v) => Number.isFinite(v)));

    // Track visible Y bounds across candles + active levels so LOG scale computes exact log10 range
    let yLowBound = priceMin;
    let yHighBound = priceMax;
    const expandBound = (val) => {
      if (Number.isFinite(val) && val > 0) {
        if (val < yLowBound) yLowBound = val;
        if (val > yHighBound) yHighBound = val;
      }
    };
    if (overlays.maRibbon) {
      candles.forEach((c) => {
        expandBound(c.ema9);
        expandBound(c.ema21);
        expandBound(c.sma50);
        expandBound(c.sma150);
        expandBound(c.sma200);
      });
    }
    if (overlays.gexWalls && Array.isArray(data.levels)) {
      data.levels.forEach((lv) => {
        if (lv.price && lv.price >= priceMin * 0.65 && lv.price <= priceMax * 1.45) {
          expandBound(lv.price);
        }
      });
    }
    if (overlays.marketsurgePattern && data.marketsurge?.buy_point > 0) {
      if (data.marketsurge.buy_point <= priceMax * 1.45) expandBound(data.marketsurge.buy_point);
      if (data.marketsurge.is_actionable_buy_point !== false && data.marketsurge.buy_zone_high <= priceMax * 1.45) {
        expandBound(data.marketsurge.buy_zone_high);
      }
    }
    if (overlays.tradePlanZones && data.trade_plan) {
      expandBound(data.trade_plan.stop_loss);
      expandBound(data.trade_plan.profit_target);
    }

    const traces = [];
    const shapes = [];
    const rawAnnotations = [];

    traces.push({
      x: dates,
      open: opens,
      high: highs,
      low: lows,
      close: closes,
      type: 'candlestick',
      xaxis: 'x',
      yaxis: 'y',
      name: `${data.ticker} (${data.timeframe || activePresetObj.timeframe})`,
      increasing: { line: { color: '#10b981', width: 1.25 }, fillcolor: '#10b981' },
      decreasing: { line: { color: '#ef4444', width: 1.25 }, fillcolor: '#ef4444' },
      whiskerwidth: 0.4,
    });

    if (overlays.maRibbon) {
      traces.push({
        x: dates,
        y: candles.map((c) => c.ema9),
        type: 'scatter',
        mode: 'lines',
        name: '9 EMA',
        line: { color: '#38bdf8', width: 1.35 },
        yaxis: 'y',
        hovertemplate: '9 EMA: $%{y:.2f}<extra></extra>',
      });
      traces.push({
        x: dates,
        y: candles.map((c) => c.ema21),
        type: 'scatter',
        mode: 'lines',
        name: '21 EMA',
        line: { color: '#10b981', width: 1.5 },
        fill: overlays.emaCloud ? 'tonexty' : 'none',
        fillcolor: 'rgba(16, 185, 129, 0.08)',
        yaxis: 'y',
        hovertemplate: '21 EMA: $%{y:.2f}<extra></extra>',
      });
      traces.push({
        x: dates,
        y: candles.map((c) => c.sma50),
        type: 'scatter',
        mode: 'lines',
        name: '50 SMA',
        line: { color: '#f59e0b', width: 1.9 },
        yaxis: 'y',
        hovertemplate: '50 SMA: $%{y:.2f}<extra></extra>',
      });
      traces.push({
        x: dates,
        y: candles.map((c) => c.sma150),
        type: 'scatter',
        mode: 'lines',
        name: '150 SMA',
        line: { color: '#a855f7', width: 1.4, dash: 'dot' },
        yaxis: 'y',
        hovertemplate: '150 SMA: $%{y:.2f}<extra></extra>',
      });
      traces.push({
        x: dates,
        y: candles.map((c) => c.sma200),
        type: 'scatter',
        mode: 'lines',
        name: '200 SMA',
        line: { color: '#ef4444', width: 2.1 },
        yaxis: 'y',
        hovertemplate: '200 SMA: $%{y:.2f}<extra></extra>',
      });
    }

    if (overlays.bollinger) {
      traces.push({
        x: dates,
        y: candles.map((c) => c.bb_upper),
        type: 'scatter',
        mode: 'lines',
        name: 'BB Upper',
        line: { color: 'rgba(192, 132, 252, 0.55)', width: 1, dash: 'dash' },
        yaxis: 'y',
        hoverinfo: 'skip',
      });
      traces.push({
        x: dates,
        y: candles.map((c) => c.bb_lower),
        type: 'scatter',
        mode: 'lines',
        name: 'BB Lower',
        line: { color: 'rgba(192, 132, 252, 0.55)', width: 1, dash: 'dash' },
        fill: 'tonexty',
        fillcolor: 'rgba(168, 85, 247, 0.05)',
        yaxis: 'y',
        hoverinfo: 'skip',
      });
    }

    // 48-Bin OHLC Volume Profile + Left-Anchored VAH / VAL Labels
    if (overlays.volumeProfile && data.volume_profile && Array.isArray(data.volume_profile.bins)) {
      const vp = data.volume_profile;
      vp.bins.forEach((b) => {
        if (!b.pct_of_max || b.pct_of_max <= 1) return;
        const barWidthPaper = (b.pct_of_max / 100.0) * 0.16;
        const isPocBin = vp.poc_price && Math.abs(b.price_mid - vp.poc_price) <= (b.price_high - b.price_low) * 0.6;
        const inVa =
          vp.vah_price && vp.val_price && b.price_mid <= vp.vah_price && b.price_mid >= vp.val_price;
        shapes.push({
          type: 'rect',
          xref: 'paper',
          x0: 1.0 - barWidthPaper,
          x1: 1.0,
          yref: 'y',
          y0: b.price_low,
          y1: b.price_high,
          fillcolor: isPocBin
            ? 'rgba(56, 189, 248, 0.42)'
            : inVa
            ? 'rgba(99, 102, 241, 0.20)'
            : 'rgba(148, 163, 184, 0.09)',
          line: {
            color: isPocBin ? 'rgba(56, 189, 248, 0.85)' : 'rgba(148, 163, 184, 0.12)',
            width: isPocBin ? 1.1 : 0.4,
          },
          layer: 'below',
        });
      });

      if (vp.vah_price) {
        shapes.push({
          type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: vp.vah_price, y1: vp.vah_price,
          line: { color: 'rgba(99, 102, 241, 0.45)', width: 1, dash: 'dot' },
        });
        rawAnnotations.push({
          xref: 'paper', x: 0.008, yref: 'y', y: vp.vah_price,
          text: `VAH $${vp.vah_price.toFixed(2)}`,
          showarrow: false, xanchor: 'left', yanchor: 'middle',
          font: { color: '#818cf8', size: 9.5, family: 'monospace' },
          bgcolor: 'rgba(9, 13, 22, 0.85)', borderpad: 2,
        });
      }
      if (vp.val_price) {
        shapes.push({
          type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: vp.val_price, y1: vp.val_price,
          line: { color: 'rgba(99, 102, 241, 0.45)', width: 1, dash: 'dot' },
        });
        rawAnnotations.push({
          xref: 'paper', x: 0.008, yref: 'y', y: vp.val_price,
          text: `VAL $${vp.val_price.toFixed(2)}`,
          showarrow: false, xanchor: 'left', yanchor: 'middle',
          font: { color: '#818cf8', size: 9.5, family: 'monospace' },
          bgcolor: 'rgba(9, 13, 22, 0.85)', borderpad: 2,
        });
      }
    }

    // GEX Walls & POC / VCP Pivot Lines (POC anchored Left, GEX Walls & Pivots Right + collision resolved)
    if (data.levels && Array.isArray(data.levels)) {
      data.levels.forEach((level) => {
        const isGexType = ['CALL_WALL', 'PUT_WALL', 'ZERO_GAMMA', 'MAX_PAIN'].includes(level.type);
        if (isGexType && !overlays.gexWalls) return;
        if (level.type === 'POC' && !overlays.volumeProfile) return;
        if (level.type === 'PIVOT' && !overlays.vcpAndFootprints) return;

        shapes.push({
          type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: level.price, y1: level.price,
          line: {
            color: level.color,
            width: level.type === 'POC' || level.type === 'PIVOT' ? 1.7 : 1.35,
            dash: level.type === 'POC' ? 'solid' : 'dash',
          },
        });

        const anchorLeft = level.type === 'POC';
        const isVcpPivot = level.type === 'PIVOT';
        rawAnnotations.push({
          xref: 'paper',
          x: anchorLeft ? 0.008 : isVcpPivot ? 0.36 : 0.992,
          yref: 'y',
          y: level.price,
          text: `<b>${level.title}</b>`,
          showarrow: false,
          xanchor: anchorLeft || isVcpPivot ? 'left' : 'right',
          yanchor: 'middle',
          font: { color: level.color, size: 9.5, family: 'monospace' },
          bgcolor: 'rgba(9, 13, 22, 0.88)',
          bordercolor: `${level.color}55`,
          borderwidth: 1,
          borderpad: 2,
        });
      });
    }

    // Causal VCP Waves + Pocket Pivots + VDU
    if (overlays.vcpAndFootprints) {
      if (Array.isArray(data.vcp_waves)) {
        const recentStartIdx = Math.max(0, dates.length - 25);
        const recentCutoffDate = dates[recentStartIdx] || '';
        data.vcp_waves.forEach((wave) => {
          shapes.push({
            type: 'line', xref: 'x', x0: wave.start_date, x1: wave.end_date,
            yref: 'y', y0: wave.start_price, y1: wave.end_price,
            line: { color: wave.color, width: 2, dash: 'dash' },
          });
          const nearRight = wave.end_date >= recentCutoffDate;
          rawAnnotations.push({
            xref: 'x', x: wave.end_date, yref: 'y', y: wave.end_price,
            text: `<b>${wave.name.replace(' Contraction', '')}: -${wave.depth_pct}%</b>`,
            showarrow: true, arrowhead: 2, arrowcolor: wave.color,
            ax: nearRight ? -36 : 0,
            ay: 20,
            font: { color: wave.color, size: 9, family: 'monospace' },
            bgcolor: 'rgba(9, 13, 22, 0.90)', bordercolor: wave.color, borderwidth: 1, borderpad: 2,
          });
        });
      }

      if (Array.isArray(data.pocket_pivots) && data.pocket_pivots.length > 0) {
        traces.push({
          x: data.pocket_pivots.map((p) => p.time),
          y: data.pocket_pivots.map((p) => p.price),
          type: 'scatter',
          mode: 'markers',
          name: '⚡ Pocket Pivot',
          marker: { color: '#00f2fe', size: 7.5, symbol: 'triangle-up', line: { color: '#090d16', width: 1 } },
          yaxis: 'y',
          hovertemplate: '<b>⚡ Pocket Pivot Buy</b><br>Date: %{x}<br>Low: $%{y:.2f}<extra></extra>',
        });
      }

      if (Array.isArray(data.vdu_markers) && data.vdu_markers.length > 0) {
        traces.push({
          x: data.vdu_markers.map((v) => v.time),
          y: data.vdu_markers.map((v) => v.price),
          type: 'scatter',
          mode: 'markers',
          name: '💧 VDU',
          marker: { color: '#fbbf24', size: 6.5, symbol: 'diamond', line: { color: '#090d16', width: 1 } },
          yaxis: 'y',
          hovertemplate: '<b>💧 Volume Dry-Up</b><br>Date: %{x}<extra></extra>',
        });
      }
    }

    if (Array.isArray(data.blue_dots) && data.blue_dots.length > 0) {
      traces.push({
        x: data.blue_dots.map((b) => b.time),
        y: data.blue_dots.map((b) => b.price),
        type: 'scatter',
        mode: 'markers',
        name: '🔵 RS Blue Dot',
        marker: { color: '#38bdf8', size: 8, symbol: 'circle', line: { color: '#ffffff', width: 1.3 } },
        yaxis: 'y',
        hovertemplate: '<b>🔵 RS Blue Dot</b><br>Date: %{x}<br>$%{y:.2f}<extra></extra>',
      });
    }

    // Direction-Aware Trade Plan Zones (Only LONG/WAIT_PULLBACK renders Green Target Box; DEFENSIVE renders Reclaim & Support)
    if (overlays.tradePlanZones && data.trade_plan) {
      const tp = data.trade_plan;
      if (tp.direction === 'DEFENSIVE') {
        shapes.push({
          type: 'line', xref: 'paper', x0: 0.65, x1: 1.0, yref: 'y', y0: tp.reclaim_trigger || tp.profit_target, y1: tp.reclaim_trigger || tp.profit_target,
          line: { color: '#f59e0b', width: 1.8, dash: 'dash' },
        });
        shapes.push({
          type: 'line', xref: 'paper', x0: 0.65, x1: 1.0, yref: 'y', y0: tp.stop_loss, y1: tp.stop_loss,
          line: { color: '#ef4444', width: 1.6, dash: 'dot' },
        });
        rawAnnotations.push({
          xref: 'paper', x: 0.992, yref: 'y', y: tp.reclaim_trigger || tp.profit_target,
          text: `🛡️ Reclaim Trigger: $${(tp.reclaim_trigger || tp.profit_target).toFixed(2)}`,
          showarrow: false, xanchor: 'right', yanchor: 'middle',
          font: { color: '#f59e0b', size: 9.5, family: 'monospace' },
          bgcolor: 'rgba(9, 13, 22, 0.9)', borderpad: 2,
        });
        rawAnnotations.push({
          xref: 'paper', x: 0.992, yref: 'y', y: tp.stop_loss,
          text: `🛑 Floor -2 ATR: $${tp.stop_loss.toFixed(2)}`,
          showarrow: false, xanchor: 'right', yanchor: 'middle',
          font: { color: '#ef4444', size: 9.5, family: 'monospace' },
          bgcolor: 'rgba(9, 13, 22, 0.9)', borderpad: 2,
        });
      } else {
        shapes.push({
          type: 'rect', xref: 'paper', x0: 0.72, x1: 1.0, yref: 'y', y0: tp.entry, y1: tp.profit_target,
          fillcolor: 'rgba(16, 185, 129, 0.11)', line: { color: 'rgba(16, 185, 129, 0.5)', width: 1, dash: 'dot' },
        });
        shapes.push({
          type: 'rect', xref: 'paper', x0: 0.72, x1: 1.0, yref: 'y', y0: tp.stop_loss, y1: tp.entry,
          fillcolor: 'rgba(239, 68, 68, 0.12)', line: { color: 'rgba(239, 68, 68, 0.5)', width: 1, dash: 'dot' },
        });
        rawAnnotations.push({
          xref: 'paper', x: 0.725, yref: 'y', y: tp.profit_target,
          text: `🎯 T2 +3.5 ATR: $${tp.profit_target.toFixed(2)} (+${tp.reward_pct}%)`,
          showarrow: false, xanchor: 'left', yanchor: 'middle',
          font: { color: '#10b981', size: 9.5, family: 'monospace' },
          bgcolor: 'rgba(9, 13, 22, 0.9)', borderpad: 2,
        });
        rawAnnotations.push({
          xref: 'paper', x: 0.725, yref: 'y', y: tp.stop_loss,
          text: `🛑 Stop -2 ATR: $${tp.stop_loss.toFixed(2)} (-${tp.risk_pct}%)`,
          showarrow: false, xanchor: 'left', yanchor: 'middle',
          font: { color: '#ef4444', size: 9.5, family: 'monospace' },
          bgcolor: 'rgba(9, 13, 22, 0.9)', borderpad: 2,
        });
      }
    }

    // Stage-Gated MarketSurge Pattern Overlay (Only draw green 5% buy zone when pattern is an actionable base)
    if (overlays.marketsurgePattern && data.marketsurge && data.marketsurge.buy_point > 0) {
      const ms = data.marketsurge;
      const isActionable = ms.is_actionable_buy_point !== false;

      if (Array.isArray(ms.cup_curve) && ms.cup_curve.length >= 2) {
        traces.push({
          x: ms.cup_curve.map((pt) => pt.time),
          y: ms.cup_curve.map((pt) => pt.price),
          type: 'scatter',
          mode: 'lines',
          name: `🏆 ${ms.pattern_name}`,
          line: { color: '#c084fc', width: 2.3, dash: 'dash', shape: 'spline' },
          yaxis: 'y',
          hovertemplate: `<b>${ms.pattern_name}</b>: $%{y:.2f}<extra></extra>`,
        });
      }

      if (Array.isArray(ms.handle_curve) && ms.handle_curve.length >= 2) {
        traces.push({
          x: ms.handle_curve.map((pt) => pt.time),
          y: ms.handle_curve.map((pt) => pt.price),
          type: 'scatter',
          mode: 'lines+markers',
          name: `☕ Handle (-${ms.handle_depth_pct || 0}%)`,
          line: { color: '#fbbf24', width: 2.2, dash: 'dot' },
          marker: { color: '#fbbf24', size: 5.5, symbol: 'diamond' },
          yaxis: 'y',
          hovertemplate: '<b>Handle</b>: $%{y:.2f}<extra></extra>',
        });
      }

      if (Array.isArray(ms.keypoints) && ms.keypoints.length > 0) {
        traces.push({
          x: ms.keypoints.map((k) => k.time),
          y: ms.keypoints.map((k) => k.price),
          type: 'scatter',
          mode: 'markers',
          name: 'Base Pivots',
          text: ms.keypoints.map((k) => k.label),
          marker: {
            color: ms.keypoints.map((k) =>
              k.label.includes('Bottom') || k.label.includes('Low') ? '#f59e0b' : '#c084fc'
            ),
            size: 7,
            symbol: 'circle',
            line: { color: '#090d16', width: 1.5 },
          },
          yaxis: 'y',
          hovertemplate: '<b>%{text}</b>: $%{y:.2f}<extra></extra>',
        });
      }

      if (isActionable) {
        shapes.push({
          type: 'rect', xref: 'paper', x0: 0.56, x1: 1.0, yref: 'y', y0: ms.buy_point, y1: ms.buy_zone_high,
          fillcolor: 'rgba(16, 185, 129, 0.13)', line: { color: 'rgba(16, 185, 129, 0.5)', width: 1, dash: 'dot' }, layer: 'below',
        });
        shapes.push({
          type: 'line', xref: 'paper', x0: 0.35, x1: 1.0, yref: 'y', y0: ms.buy_point, y1: ms.buy_point,
          line: { color: '#10b981', width: 2.0, dash: 'dash' },
        });
        rawAnnotations.push({
          xref: 'paper', x: 0.36, yref: 'y', y: ms.buy_point,
          text: `🎯 MS Buy Pt $${ms.buy_point.toFixed(2)}`,
          showarrow: false, xanchor: 'left', yanchor: 'middle',
          font: { color: '#10b981', size: 9.5, family: 'monospace' },
          bgcolor: 'rgba(6, 78, 59, 0.92)', bordercolor: 'rgba(16, 185, 129, 0.65)', borderpad: 2,
        });
      } else {
        shapes.push({
          type: 'line', xref: 'paper', x0: 0.45, x1: 1.0, yref: 'y', y0: ms.buy_point, y1: ms.buy_point,
          line: { color: '#f59e0b', width: 1.7, dash: 'dash' },
        });
        rawAnnotations.push({
          xref: 'paper', x: 0.36, yref: 'y', y: ms.buy_point,
          text: `🛡️ Reclaim $${ms.buy_point.toFixed(2)}`,
          showarrow: false, xanchor: 'left', yanchor: 'middle',
          font: { color: '#f59e0b', size: 9.5, family: 'monospace' },
          bgcolor: 'rgba(9, 13, 22, 0.92)', bordercolor: 'rgba(245, 158, 11, 0.6)', borderpad: 2,
        });
      }
    }

    // Separate paper-y annotations from x-pinned VCP wave annotations; transform x-pinned y to log10 in LOG mode
    const paperAnns = rawAnnotations.filter((a) => a.xref === 'paper');
    const coordAnns = rawAnnotations
      .filter((a) => a.xref !== 'paper')
      .map((a) => ({
        ...a,
        y: logScale && a.y > 0 ? Math.log10(a.y) : a.y,
      }));
    const resolvedPaperAnns = resolveAnnotationCollisions(paperAnns, yLowBound, yHighBound, logScale);
    const annotations = [...resolvedPaperAnns, ...coordAnns];

    // PANE 2: VOLUME + 50-BAR SMA
    const volColors = candles.map((c) => {
      if (c.is_pocket_pivot) return '#00f2fe';
      if (c.is_vdu) return '#fbbf24';
      return c.is_up ? 'rgba(16, 185, 129, 0.65)' : 'rgba(239, 68, 68, 0.65)';
    });

    traces.push({
      x: dates, y: vols, type: 'bar', name: 'Volume', marker: { color: volColors }, yaxis: 'y2',
      hovertemplate: 'Vol: %{y:,}<extra></extra>',
    });
    traces.push({
      x: dates, y: volSma50, type: 'scatter', mode: 'lines', name: '50 Vol SMA',
      line: { color: '#f59e0b', width: 1.2 }, yaxis: 'y2',
      hovertemplate: '50 Vol SMA: %{y:,.0f}<extra></extra>',
    });

    // PANE 3: IBD RS LINE + 21-EMA
    if (!isFullPriceOnly && Array.isArray(data.rs_series) && data.rs_series.length > 0) {
      traces.push({
        x: data.rs_series.map((r) => r.time), y: data.rs_series.map((r) => r.value),
        type: 'scatter', mode: 'lines', name: 'IBD RS', line: { color: '#00E676', width: 1.85 },
        yaxis: 'y3', hovertemplate: 'IBD RS: %{y:.2f}<extra></extra>',
      });
      traces.push({
        x: data.rs_series.map((r) => r.time), y: data.rs_series.map((r) => r.ema21),
        type: 'scatter', mode: 'lines', name: 'RS 21-EMA', line: { color: '#38bdf8', width: 1.15, dash: 'dot' },
        yaxis: 'y3', hovertemplate: 'RS 21-EMA: %{y:.2f}<extra></extra>',
      });
      if (Array.isArray(data.blue_dots) && data.blue_dots.length > 0) {
        traces.push({
          x: data.blue_dots.map((b) => b.time), y: data.blue_dots.map((b) => b.rs_value),
          type: 'scatter', mode: 'markers', name: 'RS Blue Dot',
          marker: { color: '#00E676', size: 7, symbol: 'circle', line: { color: '#ffffff', width: 1.1 } },
          yaxis: 'y3', hovertemplate: '<b>🔵 RS Blue Dot</b>: %{y:.2f}<extra></extra>',
        });
      }
    }

    // PANE 4: MOMENTUM / VOLATILITY OSCILLATOR
    let pane4Title = 'TTM Sqz';
    if (!isFullPriceOnly) {
      if (oscMode === 'ttm_squeeze') {
        pane4Title = 'TTM Squeeze';
        const sqzColors = candles.map((c) => {
          if (c.sqz_mom >= 0) return c.sqz_rising ? '#00f2fe' : '#3b82f6';
          return c.sqz_rising ? '#f59e0b' : '#ef4444';
        });
        traces.push({
          x: dates, y: candles.map((c) => c.sqz_mom), type: 'bar', name: 'Sqz Mom',
          marker: { color: sqzColors }, yaxis: 'y4', hovertemplate: 'Sqz Mom: %{y:.3f}<extra></extra>',
        });
        traces.push({
          x: dates, y: candles.map(() => 0), type: 'scatter', mode: 'markers', name: 'Sqz Dots',
          marker: { color: candles.map((c) => (c.squeeze_on ? '#ef4444' : '#10b981')), size: 5, symbol: 'circle' },
          yaxis: 'y4', hovertemplate: '%{text}<extra></extra>',
          text: candles.map((c) => (c.squeeze_on ? '🔴 SQUEEZE ON (BB < KC)' : '🟢 SQUEEZE RELEASED')),
        });
      } else if (oscMode === 'macd') {
        pane4Title = 'MACD (12,26,9)';
        traces.push({
          x: dates, y: candles.map((c) => c.macd_hist), type: 'bar', name: 'MACD Hist',
          marker: { color: candles.map((c) => (c.macd_hist >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)')) },
          yaxis: 'y4', hovertemplate: 'Hist: %{y:.3f}<extra></extra>',
        });
        traces.push({
          x: dates, y: candles.map((c) => c.macd), type: 'scatter', mode: 'lines', name: 'MACD',
          line: { color: '#38bdf8', width: 1.5 }, yaxis: 'y4', hovertemplate: 'MACD: %{y:.3f}<extra></extra>',
        });
        traces.push({
          x: dates, y: candles.map((c) => c.macd_signal), type: 'scatter', mode: 'lines', name: 'Signal',
          line: { color: '#f59e0b', width: 1.3 }, yaxis: 'y4', hovertemplate: 'Signal: %{y:.3f}<extra></extra>',
        });
      } else if (oscMode === 'rsi') {
        pane4Title = 'RSI (14)';
        traces.push({
          x: dates, y: candles.map((c) => c.rsi14), type: 'scatter', mode: 'lines', name: 'RSI (14)',
          line: { color: '#c084fc', width: 1.7 }, yaxis: 'y4', hovertemplate: 'RSI: %{y:.1f}<extra></extra>',
        });
        traces.push({
          x: dates, y: candles.map((c) => c.rsi_sma14), type: 'scatter', mode: 'lines', name: 'RSI SMA',
          line: { color: '#fbbf24', width: 1.2, dash: 'dot' }, yaxis: 'y4', hovertemplate: 'RSI SMA: %{y:.1f}<extra></extra>',
        });
        [30, 50, 70].forEach((lvl) => {
          shapes.push({
            type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y4', y0: lvl, y1: lvl,
            line: { color: lvl === 50 ? 'rgba(148,163,184,0.35)' : 'rgba(192,132,252,0.3)', width: 1, dash: 'dot' },
          });
        });
      } else if (oscMode === 'adx') {
        pane4Title = 'ADX (14)';
        traces.push({
          x: dates, y: candles.map((c) => c.adx14), type: 'scatter', mode: 'lines', name: 'ADX',
          line: { color: '#fbbf24', width: 1.9 }, yaxis: 'y4', hovertemplate: 'ADX: %{y:.1f}<extra></extra>',
        });
        traces.push({
          x: dates, y: candles.map((c) => c.plus_di), type: 'scatter', mode: 'lines', name: '+DI',
          line: { color: '#10b981', width: 1.35 }, yaxis: 'y4', hovertemplate: '+DI: %{y:.1f}<extra></extra>',
        });
        traces.push({
          x: dates, y: candles.map((c) => c.minus_di), type: 'scatter', mode: 'lines', name: '-DI',
          line: { color: '#ef4444', width: 1.35 }, yaxis: 'y4', hovertemplate: '-DI: %{y:.1f}<extra></extra>',
        });
        [20, 25].forEach((lvl) => {
          shapes.push({
            type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y4', y0: lvl, y1: lvl,
            line: { color: 'rgba(251, 191, 36, 0.35)', width: 1, dash: 'dot' },
          });
        });
      }
    }

    const computedHeight = isFullscreen
      ? Math.max(520, (window.innerHeight || viewportHeight) - 160)
      : 660;
    const uiRevKey = `${data.ticker || ticker}_${data.timeframe || '1D'}_${data.range || '1Y'}_${paneLayout}_${logScale}_${isFullscreen ? 'fs' : 'dock'}`;

    const layout = {
      autosize: true,
      height: computedHeight,
      uirevision: uiRevKey,
      dragmode: 'pan',
      paper_bgcolor: '#070b12',
      plot_bgcolor: '#070b12',
      margin: { t: 8, r: 66, l: 16, b: 26 },
      hovermode: 'x unified',
      showlegend: false, // Rendered cleanly in our single-line header legend strip so chart gets 100% height
      xaxis: {
        uirevision: uiRevKey,
        rangeslider: { visible: false },
        type: 'category',
        gridcolor: 'rgba(148, 163, 184, 0.06)',
        tickfont: { color: '#64748b', size: 10, family: 'monospace' },
        showspikes: true,
        spikemode: 'across',
        spikedash: 'dot',
        spikecolor: '#475569',
        spikethickness: 1,
        nticks: 10,
      },
      yaxis: {
        uirevision: uiRevKey,
        title: { text: 'Price ($)', font: { color: '#94a3b8', size: 10 } },
        type: logScale ? 'log' : 'linear',
        gridcolor: 'rgba(148, 163, 184, 0.06)',
        tickfont: { color: '#cbd5e1', size: 10, family: 'monospace' },
        side: 'right',
        showspikes: true,
        spikemode: 'across',
        spikedash: 'dot',
        spikecolor: '#475569',
        spikethickness: 1,
        fixedrange: false,
        autorange: !logScale,
        ...(logScale && Number.isFinite(yLowBound) && Number.isFinite(yHighBound) && yLowBound > 0 && yHighBound > yLowBound
          ? { range: [Math.log10(yLowBound * 0.97), Math.log10(yHighBound * 1.03)] }
          : {}),
        domain: isFullPriceOnly ? [0.19, 1.0] : [0.43, 1.0],
      },
      yaxis2: {
        uirevision: uiRevKey,
        title: { text: 'Vol', font: { color: '#64748b', size: 9.5 } },
        gridcolor: 'rgba(148, 163, 184, 0.04)',
        tickfont: { color: '#64748b', size: 9, family: 'monospace' },
        side: 'right',
        fixedrange: false,
        autorange: true,
        domain: isFullPriceOnly ? [0.0, 0.16] : [0.28, 0.41],
      },
      ...(isFullPriceOnly
        ? {}
        : {
            yaxis3: {
              uirevision: uiRevKey,
              title: { text: 'IBD RS', font: { color: '#00E676', size: 9.5 } },
              gridcolor: 'rgba(0, 230, 118, 0.06)',
              tickfont: { color: '#00E676', size: 9, family: 'monospace' },
              side: 'right',
              fixedrange: false,
              autorange: true,
              domain: [0.14, 0.26],
            },
            yaxis4: {
              uirevision: uiRevKey,
              title: { text: pane4Title, font: { color: '#38bdf8', size: 9.5 } },
              gridcolor: 'rgba(56, 189, 248, 0.06)',
              tickfont: { color: '#94a3b8', size: 9, family: 'monospace' },
              side: 'right',
              fixedrange: false,
              autorange: true,
              domain: [0.0, 0.12],
            },
          }),
      shapes,
      annotations,
      modebar: {
        add: ['drawline', 'drawopenpath', 'drawcircle', 'drawrect', 'eraseshape'],
        activecolor: '#38bdf8',
        bgcolor: 'rgba(15, 23, 42, 0.8)',
        color: '#94a3b8',
      },
      newshape: { line: { color: '#38bdf8', width: 2 } },
    };

    const config = { responsive: true, displayModeBar: true, scrollZoom: true, displaylogo: false };

    const renderPlot = () => {
      if (!plotRef.current || !window.Plotly) return;
      window.Plotly.react(plotRef.current, traces, layout, config);
      requestAnimationFrame(() => {
        if (plotRef.current && window.Plotly) window.Plotly.Plots.resize(plotRef.current);
      });
      if (plotRef.current.removeAllListeners) {
        plotRef.current.removeAllListeners('plotly_hover');
      }
      if (plotRef.current.on) {
        plotRef.current.on('plotly_hover', (eventData) => {
          const ptDate = eventData?.points?.[0]?.x;
          if (!ptDate || ptDate === lastHoveredTimeRef.current) return;
          lastHoveredTimeRef.current = ptDate;
          if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
          hoverRafRef.current = requestAnimationFrame(() => {
            const found = candles.find((c) => c.time === ptDate);
            if (found) setHoveredBar(found);
          });
        });
      }
    };

    if (window.Plotly) {
      renderPlot();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.plot.ly/plotly-2.32.0.min.js';
      script.onload = renderPlot;
      document.head.appendChild(script);
    }
  }, [chartPayload, overlays, oscMode, logScale, isFullscreen, paneLayout, viewportHeight, ticker, activePresetObj.timeframe]);

  const activeBar = hoveredBar || (chartPayload?.candles ? chartPayload.candles[chartPayload.candles.length - 1] : null);
  const sm = chartPayload?.summary_metrics || {};

  const handleFsTickerSearch = (e) => {
    e.preventDefault();
    const sym = fsSearchInput.trim().toUpperCase();
    if (!sym) return;
    if (typeof onSelectTicker === 'function') onSelectTicker(sym);
    setFsSearchInput('');
  };

  const chartNode = (
    <div
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : '100%',
        zIndex: isFullscreen ? 999999 : 1,
        background: '#070b12',
        border: '1px solid rgba(148, 163, 184, 0.16)',
        borderRadius: isFullscreen ? 0 : '10px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* DEDICATED FULL-CHART HEADER BAR */}
      {isFullscreen && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            padding: '0.4rem 0.85rem',
            background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.98), rgba(9, 13, 22, 0.98))',
            borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace' }}>
              🖥️ {ticker} FULL CHART
            </span>
            {sm.last_price > 0 && (
              <span style={{ fontFamily: 'monospace', fontSize: '0.98rem', fontWeight: 800, color: '#f8fafc' }}>
                ${sm.last_price.toFixed(2)}{' '}
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: (sm.change_1d_pct || 0) >= 0 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                    color: (sm.change_1d_pct || 0) >= 0 ? '#10b981' : '#f87171',
                  }}
                >
                  {(sm.change_1d_pct || 0) >= 0 ? '+' : ''}
                  {(sm.change_1d_pct || 0).toFixed(2)}%
                </span>
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              {QUICK_FS_TICKERS.map((sym) => {
                const isCurr = sym === ticker;
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => onSelectTicker && onSelectTicker(sym)}
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: isCurr ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.2)',
                      background: isCurr ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 6, 23, 0.6)',
                      color: isCurr ? '#38bdf8' : '#cbd5e1',
                      fontSize: '0.68rem',
                      fontFamily: 'monospace',
                      fontWeight: isCurr ? 800 : 600,
                      cursor: 'pointer',
                    }}
                  >
                    {sym}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {typeof onSelectTicker === 'function' && (
              <form onSubmit={handleFsTickerSearch} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', background: 'rgba(2, 6, 23, 0.8)',
                    border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '5px', padding: '2px 7px',
                  }}
                >
                  <Search size={12} color="#38bdf8" style={{ marginRight: '4px' }} />
                  <input
                    type="text" value={fsSearchInput} onChange={(e) => setFsSearchInput(e.target.value)}
                    placeholder="Switch ticker..."
                    style={{
                      background: 'transparent', border: 'none', outline: 'none',
                      color: '#f8fafc', fontFamily: 'monospace', fontSize: '0.73rem', width: '115px',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '3px 8px', borderRadius: '5px', border: '1px solid #38bdf8',
                    background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '0.71rem', fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  Go
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              style={{
                padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.5)',
                background: 'rgba(239, 68, 68, 0.16)', color: '#f87171', fontSize: '0.72rem',
                fontWeight: 800, fontFamily: 'monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <Minimize2 size={13} /> Exit Full Chart (ESC)
            </button>
          </div>
        </div>
      )}

      {/* 1. COMPACT CHART CONTROL BAR */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.35rem',
          padding: '0.38rem 0.65rem',
          background: 'rgba(15, 23, 42, 0.92)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 700, marginRight: '2px' }}>TF</span>
          {TIMEFRAME_PRESETS.map((p) => {
            const active = tfPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setTfPreset(p.id)}
                style={{
                  padding: '2px 6px',
                  fontSize: '0.68rem',
                  fontFamily: 'monospace',
                  fontWeight: active ? 800 : 600,
                  borderRadius: '4px',
                  border: active ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.16)',
                  background: active ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 6, 23, 0.5)',
                  color: active ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
          {[
            { key: 'marketsurgePattern', label: '🏆 MS Buy Pt', color: '#c084fc' },
            { key: 'maRibbon', label: '📈 MAs', color: '#f59e0b' },
            { key: 'emaCloud', label: '☁️ 9/21', color: '#10b981' },
            { key: 'volumeProfile', label: '📊 Vol Prof', color: '#38bdf8' },
            { key: 'gexWalls', label: '🛡️ GEX', color: '#a855f7' },
            { key: 'vcpAndFootprints', label: '⚡ VCP/PP', color: '#00f2fe' },
            { key: 'tradePlanZones', label: '🎯 R:R Box', color: '#34d399' },
            { key: 'bollinger', label: '🟣 BB', color: '#c084fc' },
          ].map((ov) => {
            const isOn = overlays[ov.key];
            return (
              <button
                key={ov.key}
                type="button"
                onClick={() => toggleOverlay(ov.key)}
                style={{
                  padding: '2px 6px',
                  fontSize: '0.67rem',
                  fontWeight: isOn ? 700 : 500,
                  borderRadius: '4px',
                  border: isOn ? `1px solid ${ov.color}88` : '1px solid rgba(148,163,184,0.16)',
                  background: isOn ? `${ov.color}1f` : 'rgba(2, 6, 23, 0.45)',
                  color: isOn ? ov.color : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {ov.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
          {!isFullPriceOnly &&
            OSCILLATOR_MODES.map((m) => {
              const isSel = oscMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setOscMode(m.id)}
                  style={{
                    padding: '2px 6px',
                    fontSize: '0.67rem',
                    fontWeight: isSel ? 700 : 500,
                    borderRadius: '4px',
                    border: isSel ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.16)',
                    background: isSel ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 6, 23, 0.45)',
                    color: isSel ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              );
            })}

          <button
            type="button"
            onClick={() => handleSetPaneLayout(isFullPriceOnly ? '4pane' : 'full_price')}
            style={{
              padding: '2px 7px',
              fontSize: '0.67rem',
              fontFamily: 'monospace',
              fontWeight: 800,
              borderRadius: '4px',
              border: isFullPriceOnly ? '1px solid #10b981' : '1px solid rgba(148,163,184,0.22)',
              background: isFullPriceOnly ? 'rgba(16, 185, 129, 0.18)' : 'rgba(2, 6, 23, 0.5)',
              color: isFullPriceOnly ? '#10b981' : '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            {isFullPriceOnly ? '📊 4-Pane' : '📈 Max Price'}
          </button>

          <button
            type="button"
            onClick={() => setLogScale((s) => !s)}
            style={{
              padding: '2px 6px',
              fontSize: '0.67rem',
              fontFamily: 'monospace',
              fontWeight: 700,
              borderRadius: '4px',
              border: logScale ? '1px solid #fbbf24' : '1px solid rgba(148,163,184,0.16)',
              background: logScale ? 'rgba(251, 191, 36, 0.18)' : 'rgba(2, 6, 23, 0.45)',
              color: logScale ? '#fbbf24' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            LOG
          </button>

          {showFullChartButton && (
            <button
              type="button"
              onClick={handleToggleFullscreen}
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(56, 189, 248, 0.55)',
                background: isFullscreen ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.18)',
                color: isFullscreen ? '#f87171' : '#38bdf8',
                fontSize: '0.68rem',
                fontFamily: 'monospace',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              {isFullscreen ? 'Exit' : 'Full Chart'}
            </button>
          )}
        </div>
      </div>

      {/* 2. LIVE CROSSHAIR OHLCV + MOVING AVERAGE TELEMETRY + SINGLE-LINE LEGEND STRIP */}
      {activeBar && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.35rem 0.7rem',
            padding: '0.28rem 0.65rem',
            background: 'rgba(9, 13, 22, 0.96)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
            fontFamily: 'monospace',
            fontSize: '0.69rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 800 }}>
              {ticker} ({chartPayload?.timeframe || activePresetObj.timeframe})
            </span>
            <span style={{ color: '#94a3b8', fontWeight: 700 }}>{activeBar.time}</span>
            <span>O:<strong style={{ color: '#e2e8f0' }}>${activeBar.open?.toFixed(2)}</strong></span>
            <span>H:<strong style={{ color: '#10b981' }}>${activeBar.high?.toFixed(2)}</strong></span>
            <span>L:<strong style={{ color: '#ef4444' }}>${activeBar.low?.toFixed(2)}</strong></span>
            <span>
              C:<strong style={{ color: activeBar.is_up ? '#10b981' : '#ef4444' }}>${activeBar.close?.toFixed(2)}</strong>
            </span>
            <span>
              Vol:<strong style={{ color: activeBar.rvol >= 1.5 ? '#00f2fe' : '#cbd5e1' }}>
                {(activeBar.value / 1e6).toFixed(2)}M ({activeBar.rvol}x)
              </strong>
            </span>
            <span>
              CLV:<strong style={{ color: activeBar.clv >= 65 ? '#10b981' : activeBar.clv <= 35 ? '#ef4444' : '#cbd5e1' }}>{activeBar.clv}%</strong>
            </span>
            {activeBar.is_pocket_pivot && (
              <span style={{ padding: '0 5px', borderRadius: '3px', background: 'rgba(0,242,254,0.16)', color: '#00f2fe', fontWeight: 800 }}>
                ⚡PP
              </span>
            )}
            {activeBar.is_vdu && (
              <span style={{ padding: '0 5px', borderRadius: '3px', background: 'rgba(251,191,36,0.16)', color: '#fbbf24', fontWeight: 800 }}>
                💧VDU
              </span>
            )}
            {activeBar.squeeze_on && (
              <span style={{ padding: '0 5px', borderRadius: '3px', background: 'rgba(239,68,68,0.18)', color: '#f87171', fontWeight: 800 }}>
                🔴SQZ
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {activeBar.ema9 != null && <span style={{ color: '#38bdf8' }}>━ 9E:${activeBar.ema9.toFixed(2)}</span>}
            {activeBar.ema21 != null && <span style={{ color: '#10b981' }}>━ 21E:${activeBar.ema21.toFixed(2)}</span>}
            {activeBar.sma50 != null && <span style={{ color: '#f59e0b' }}>━ 50S:${activeBar.sma50.toFixed(2)}</span>}
            {activeBar.sma150 != null && <span style={{ color: '#a855f7' }}>┈ 150S:${activeBar.sma150.toFixed(2)}</span>}
            {activeBar.sma200 != null && <span style={{ color: '#ef4444' }}>━ 200S:${activeBar.sma200.toFixed(2)}</span>}
            <span style={{ color: '#c084fc' }}>RSI:{activeBar.rsi14}</span>
            <span style={{ color: '#fbbf24' }}>ADX:{activeBar.adx14}</span>
            <span style={{ color: '#00E676' }}>━ IBD RS</span>
            {chartPayload?.data_source && (
              <span style={{ color: '#64748b', fontSize: '0.62rem' }}>[{chartPayload.data_source}]</span>
            )}
          </div>
        </div>
      )}

      {/* 3. SYNCHRONIZED 4-PANE PLOTLY CANVAS */}
      <div ref={canvasWrapRef} style={{ flex: 1, width: '100%', minHeight: isFullscreen ? '520px' : '640px', position: 'relative' }}>
        {loading && (
          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: '#38bdf8',
              zIndex: 10, background: 'rgba(7, 11, 18, 0.82)',
            }}
          >
            <Loader size={30} className="spin" style={{ marginBottom: '0.75rem' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
              Synthesizing {ticker} ({activePresetObj.label}) Quant Chart &amp; GEX Surface...
            </span>
          </div>
        )}

        {error && (
          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: '#ef4444',
              zIndex: 10, background: 'rgba(7, 11, 18, 0.9)', padding: '1.5rem',
            }}
          >
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Failed to Load Institutional Chart</span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '6px' }}>{error}</span>
            <button
              type="button"
              onClick={fetchChartData}
              style={{
                marginTop: '12px', padding: '6px 14px', borderRadius: '6px',
                border: '1px solid #38bdf8', background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8', cursor: 'pointer', fontWeight: 700,
              }}
            >
              Retry Fetch
            </button>
          </div>
        )}

        <div ref={plotRef} style={{ width: '100%', height: '100%', minHeight: isFullscreen ? '520px' : '640px' }} />
      </div>
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(chartNode, document.body);
  }
  return chartNode;
}
