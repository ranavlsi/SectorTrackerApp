import React, { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Loader, Maximize2, Minimize2, Layers, Activity, Shield, Target, Zap, BarChart2, RefreshCw, Search } from 'lucide-react';

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
  { id: 'ttm_squeeze', label: '🔥 TTM Squeeze & Mom' },
  { id: 'macd', label: '🌊 MACD (12,26,9)' },
  { id: 'rsi', label: '⚡ RSI (14) & SMA' },
  { id: 'adx', label: '🧭 ADX (14) & ±DI' },
];

export default function UnifiedPlotlyChart({
  ticker,
  onChartDataLoaded,
  onSelectTicker,
  externalPaneLayout,
  onPaneLayoutChange,
  externalFullscreen,
  onToggleFullscreen,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartPayload, setChartPayload] = useState(null);
  const [tfPreset, setTfPreset] = useState('1D_1Y');
  const [oscMode, setOscMode] = useState('ttm_squeeze');
  const [logScale, setLogScale] = useState(false);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [internalPaneLayout, setInternalPaneLayout] = useState('4pane'); // '4pane' | 'full_price'
  const [hoveredBar, setHoveredBar] = useState(null);
  const [fsSearchInput, setFsSearchInput] = useState('');
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 900
  );
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1600
  );
  const [containerWidth, setContainerWidth] = useState(0);

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

  // Institutional Overlay Toggles
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

  // Keyboard ESC listener & dynamic viewport/container resize for Full Chart mode
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
    const onResize = () => {
      setViewportHeight(window.innerHeight);
      setViewportWidth(window.innerWidth);
      if (canvasWrapRef.current) {
        setContainerWidth(canvasWrapRef.current.clientWidth);
      }
      if (plotRef.current && window.Plotly) {
        window.Plotly.Plots.resize(plotRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && canvasWrapRef.current) {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.floor(entry.contentRect.width);
          if (w > 100) {
            setContainerWidth(w);
          }
        }
        if (plotRef.current && window.Plotly) {
          window.Plotly.Plots.resize(plotRef.current);
        }
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

  // 1. Fetch Multi-Timeframe Institutional Chart Payload
  const fetchChartData = async () => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/chart_data?ticker=${encodeURIComponent(ticker)}&timeframe=${activePresetObj.timeframe}&range=${activePresetObj.range}`;
      const res = await fetch(url);
      const rawText = await res.text();
      if (!res.ok) {
        let errMsg = `Backend HTTP ${res.status}`;
        try {
          const parsedErr = JSON.parse(rawText);
          if (parsedErr.error) errMsg = parsedErr.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      const safeText = rawText.replace(/:\s*NaN\b/g, ': null').replace(/:\s*Infinity\b/g, ': null').replace(/:\s*-Infinity\b/g, ': null');
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
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, [ticker, tfPreset]);

  // 2. Render Synchronized 4-Pane Institutional Plotly Canvas
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

    const traces = [];
    const shapes = [];
    const annotations = [];

    // =========================================================================
    // PANE 1: CANDLESTICK + MOVING AVERAGES + CLOUD + VOLUME PROFILE + GEX + VCP
    // =========================================================================
    traces.push({
      x: dates,
      open: opens,
      high: highs,
      low: lows,
      close: closes,
      type: 'candlestick',
      xaxis: 'x',
      yaxis: 'y',
      name: `${data.ticker} (${data.timeframe})`,
      increasing: { line: { color: '#10b981', width: 1.3 }, fillcolor: '#10b981' },
      decreasing: { line: { color: '#ef4444', width: 1.3 }, fillcolor: '#ef4444' },
      whiskerwidth: 0.4,
    });

    // Moving Average Ribbon & 9/21 EMA Trend Cloud
    if (overlays.maRibbon) {
      const ema9 = candles.map((c) => c.ema9);
      const ema21 = candles.map((c) => c.ema21);
      const sma50 = candles.map((c) => c.sma50);
      const sma150 = candles.map((c) => c.sma150);
      const sma200 = candles.map((c) => c.sma200);

      traces.push({
        x: dates,
        y: ema9,
        type: 'scatter',
        mode: 'lines',
        name: '9 EMA',
        line: { color: '#38bdf8', width: 1.4 },
        yaxis: 'y',
        hovertemplate: '9 EMA: $%{y:.2f}<extra></extra>',
      });

      traces.push({
        x: dates,
        y: ema21,
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
        y: sma50,
        type: 'scatter',
        mode: 'lines',
        name: '50 SMA',
        line: { color: '#f59e0b', width: 2.0 },
        yaxis: 'y',
        hovertemplate: '50 SMA: $%{y:.2f}<extra></extra>',
      });

      traces.push({
        x: dates,
        y: sma150,
        type: 'scatter',
        mode: 'lines',
        name: '150 SMA',
        line: { color: '#a855f7', width: 1.5, dash: 'dot' },
        yaxis: 'y',
        hovertemplate: '150 SMA: $%{y:.2f}<extra></extra>',
      });

      traces.push({
        x: dates,
        y: sma200,
        type: 'scatter',
        mode: 'lines',
        name: '200 SMA',
        line: { color: '#ef4444', width: 2.2 },
        yaxis: 'y',
        hovertemplate: '200 SMA: $%{y:.2f}<extra></extra>',
      });
    }

    // Optional Bollinger Bands (20, 2.0)
    if (overlays.bollinger) {
      traces.push({
        x: dates,
        y: candles.map((c) => c.bb_upper),
        type: 'scatter',
        mode: 'lines',
        name: 'BB Upper (20,2)',
        line: { color: 'rgba(192, 132, 252, 0.55)', width: 1, dash: 'dash' },
        yaxis: 'y',
        hoverinfo: 'skip',
      });
      traces.push({
        x: dates,
        y: candles.map((c) => c.bb_lower),
        type: 'scatter',
        mode: 'lines',
        name: 'BB Lower (20,2)',
        line: { color: 'rgba(192, 132, 252, 0.55)', width: 1, dash: 'dash' },
        fill: 'tonexty',
        fillcolor: 'rgba(168, 85, 247, 0.05)',
        yaxis: 'y',
        hoverinfo: 'skip',
      });
    }

    // Volume-by-Price (Horizontal Volume Profile Overlay + POC / VAH / VAL)
    if (overlays.volumeProfile && data.volume_profile && Array.isArray(data.volume_profile.bins)) {
      const vp = data.volume_profile;
      vp.bins.forEach((b) => {
        if (!b.pct_of_max || b.pct_of_max <= 1) return;
        const barWidthPaper = (b.pct_of_max / 100.0) * 0.18; // Occupies up to 18% of right side of chart
        const isPocBin = vp.poc_price && Math.abs(b.price_mid - vp.poc_price) < 0.01;
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
            ? 'rgba(99, 102, 241, 0.22)'
            : 'rgba(148, 163, 184, 0.11)',
          line: {
            color: isPocBin ? 'rgba(56, 189, 248, 0.85)' : 'rgba(148, 163, 184, 0.15)',
            width: isPocBin ? 1.2 : 0.5,
          },
          layer: 'below',
        });
      });

      // VAH & VAL Horizontal Lines
      if (vp.vah_price) {
        shapes.push({
          type: 'line',
          xref: 'paper',
          x0: 0,
          x1: 1,
          yref: 'y',
          y0: vp.vah_price,
          y1: vp.vah_price,
          line: { color: 'rgba(99, 102, 241, 0.5)', width: 1, dash: 'dot' },
        });
        annotations.push({
          xref: 'paper',
          x: 0.01,
          yref: 'y',
          y: vp.vah_price,
          text: `VAH $${vp.vah_price.toFixed(2)}`,
          showarrow: false,
          xanchor: 'left',
          yanchor: 'bottom',
          font: { color: '#818cf8', size: 9.5, family: 'monospace' },
          bgcolor: 'rgba(9, 13, 22, 0.8)',
        });
      }
      if (vp.val_price) {
        shapes.push({
          type: 'line',
          xref: 'paper',
          x0: 0,
          x1: 1,
          yref: 'y',
          y0: vp.val_price,
          y1: vp.val_price,
          line: { color: 'rgba(99, 102, 241, 0.5)', width: 1, dash: 'dot' },
        });
        annotations.push({
          xref: 'paper',
          x: 0.01,
          yref: 'y',
          y: vp.val_price,
          text: `VAL $${vp.val_price.toFixed(2)}`,
          showarrow: false,
          xanchor: 'left',
          yanchor: 'top',
          font: { color: '#818cf8', size: 9.5, family: 'monospace' },
          bgcolor: 'rgba(9, 13, 22, 0.8)',
        });
      }
    }

    // Real Options GEX Walls & Key Levels
    if (data.levels && Array.isArray(data.levels)) {
      data.levels.forEach((level) => {
        const isGexType = ['CALL_WALL', 'PUT_WALL', 'ZERO_GAMMA', 'MAX_PAIN'].includes(level.type);
        if (isGexType && !overlays.gexWalls) return;
        if (level.type === 'POC' && !overlays.volumeProfile) return;
        if (level.type === 'PIVOT' && !overlays.vcpAndFootprints) return;

        shapes.push({
          type: 'line',
          xref: 'paper',
          x0: 0,
          x1: 1,
          yref: 'y',
          y0: level.price,
          y1: level.price,
          line: {
            color: level.color,
            width: level.type === 'POC' || level.type === 'PIVOT' ? 1.8 : 1.5,
            dash: level.type === 'POC' ? 'solid' : 'dash',
          },
        });

        annotations.push({
          xref: 'paper',
          x: 0.995,
          yref: 'y',
          y: level.price,
          text: `<b>${level.title}</b>`,
          showarrow: false,
          xanchor: 'right',
          yanchor: 'bottom',
          font: { color: level.color, size: 10, family: 'monospace' },
          bgcolor: 'rgba(9, 13, 22, 0.88)',
          bordercolor: `${level.color}55`,
          borderwidth: 1,
          borderpad: 2,
        });
      });
    }

    // VCP Contraction Waves + Pocket Pivots + Volume Dry-Up (VDU) + Blue Dots on Price
    if (overlays.vcpAndFootprints) {
      if (Array.isArray(data.vcp_waves)) {
        data.vcp_waves.forEach((wave) => {
          shapes.push({
            type: 'line',
            xref: 'x',
            x0: wave.start_date,
            x1: wave.end_date,
            yref: 'y',
            y0: wave.start_price,
            y1: wave.end_price,
            line: { color: wave.color, width: 2, dash: 'dash' },
          });
          annotations.push({
            xref: 'x',
            x: wave.end_date,
            yref: 'y',
            y: wave.end_price,
            text: `<b>${wave.name}: -${wave.depth_pct}%</b>`,
            showarrow: true,
            arrowhead: 2,
            arrowcolor: wave.color,
            ax: 0,
            ay: 22,
            font: { color: wave.color, size: 9.5, family: 'monospace' },
            bgcolor: 'rgba(9, 13, 22, 0.92)',
            bordercolor: wave.color,
            borderwidth: 1,
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
          marker: {
            color: '#00f2fe',
            size: 7.5,
            symbol: 'triangle-up',
            line: { color: '#090d16', width: 1 },
          },
          yaxis: 'y',
          hovertemplate: '<b>⚡ Pocket Pivot Institutional Buy</b><br>Date: %{x}<br>Low Anchor: $%{y:.2f}<extra></extra>',
        });
      }

      if (Array.isArray(data.vdu_markers) && data.vdu_markers.length > 0) {
        traces.push({
          x: data.vdu_markers.map((v) => v.time),
          y: data.vdu_markers.map((v) => v.price),
          type: 'scatter',
          mode: 'markers',
          name: '💧 VDU (Vol Dry-Up)',
          marker: {
            color: '#fbbf24',
            size: 6.5,
            symbol: 'diamond',
            line: { color: '#090d16', width: 1 },
          },
          yaxis: 'y',
          hovertemplate: '<b>💧 Volume Dry-Up (Supply Exhaustion)</b><br>Date: %{x}<extra></extra>',
        });
      }
    }

    // RS Blue Dots on Price
    if (Array.isArray(data.blue_dots) && data.blue_dots.length > 0) {
      traces.push({
        x: data.blue_dots.map((b) => b.time),
        y: data.blue_dots.map((b) => b.price),
        type: 'scatter',
        mode: 'markers',
        name: '🔵 RS Blue Dot',
        marker: {
          color: '#38bdf8',
          size: 8.5,
          symbol: 'circle',
          line: { color: '#ffffff', width: 1.4 },
        },
        yaxis: 'y',
        hovertemplate: '<b>🔵 RS Blue Dot Pivot (RS New High Before Price)</b><br>Date: %{x}<br>Price: $%{y:.2f}<extra></extra>',
      });
    }

    // Algorithmic Trade Plan R:R Zones (Entry, Stop Loss -1.5 ATR, Profit Target +3.0 ATR)
    if (overlays.tradePlanZones && data.trade_plan) {
      const tp = data.trade_plan;
      shapes.push({
        type: 'rect',
        xref: 'paper',
        x0: 0.72,
        x1: 1.0,
        yref: 'y',
        y0: tp.entry,
        y1: tp.profit_target,
        fillcolor: 'rgba(16, 185, 129, 0.11)',
        line: { color: 'rgba(16, 185, 129, 0.5)', width: 1, dash: 'dot' },
      });
      shapes.push({
        type: 'rect',
        xref: 'paper',
        x0: 0.72,
        x1: 1.0,
        yref: 'y',
        y0: tp.stop_loss,
        y1: tp.entry,
        fillcolor: 'rgba(239, 68, 68, 0.12)',
        line: { color: 'rgba(239, 68, 68, 0.5)', width: 1, dash: 'dot' },
      });
      annotations.push({
        xref: 'paper',
        x: 0.73,
        yref: 'y',
        y: tp.profit_target,
        text: `🎯 Target +3 ATR: $${tp.profit_target.toFixed(2)} (+${tp.reward_pct}%)`,
        showarrow: false,
        xanchor: 'left',
        yanchor: 'bottom',
        font: { color: '#10b981', size: 9.5, family: 'monospace' },
        bgcolor: 'rgba(9, 13, 22, 0.85)',
      });
      annotations.push({
        xref: 'paper',
        x: 0.73,
        yref: 'y',
        y: tp.stop_loss,
        text: `🛑 Stop -1.5 ATR: $${tp.stop_loss.toFixed(2)} (-${tp.risk_pct}%)`,
        showarrow: false,
        xanchor: 'left',
        yanchor: 'top',
        font: { color: '#ef4444', size: 9.5, family: 'monospace' },
        bgcolor: 'rgba(9, 13, 22, 0.85)',
      });
    }

    // 7.5 MARKET-SURGE PATTERN RECOGNITION & OFFICIAL BUY POINT OVERLAY
    if (overlays.marketsurgePattern && data.marketsurge && data.marketsurge.buy_point > 0) {
      const ms = data.marketsurge;

      // Smooth Cup / Base Contour Arc
      if (Array.isArray(ms.cup_curve) && ms.cup_curve.length >= 2) {
        traces.push({
          x: ms.cup_curve.map((pt) => pt.time),
          y: ms.cup_curve.map((pt) => pt.price),
          type: 'scatter',
          mode: 'lines',
          name: `🏆 ${ms.pattern_name}`,
          line: {
            color: '#c084fc',
            width: 2.6,
            dash: 'dash',
            shape: 'spline',
          },
          yaxis: 'y',
          hovertemplate: `<b>${ms.pattern_name} Contour</b>: $%{y:.2f}<extra></extra>`,
        });
      }

      // Handle Channel Curve (if Cup with Handle)
      if (Array.isArray(ms.handle_curve) && ms.handle_curve.length >= 2) {
        traces.push({
          x: ms.handle_curve.map((pt) => pt.time),
          y: ms.handle_curve.map((pt) => pt.price),
          type: 'scatter',
          mode: 'lines+markers',
          name: `☕ Handle (-${ms.handle_depth_pct || 0}%)`,
          line: {
            color: '#fbbf24',
            width: 2.4,
            dash: 'dot',
          },
          marker: {
            color: '#fbbf24',
            size: 6,
            symbol: 'diamond',
          },
          yaxis: 'y',
          hovertemplate: '<b>Handle Contour</b>: $%{y:.2f}<extra></extra>',
        });
      }

      // Pattern Keypoints Markers (Left Lip, Cup Bottom, Right Lip, Handle Low)
      if (Array.isArray(ms.keypoints) && ms.keypoints.length > 0) {
        traces.push({
          x: ms.keypoints.map((k) => k.time),
          y: ms.keypoints.map((k) => k.price),
          type: 'scatter',
          mode: 'markers+text',
          name: 'Pattern Pivots',
          text: ms.keypoints.map((k) => k.label),
          textposition: ms.keypoints.map((k) =>
            k.label.includes('Bottom') || k.label.includes('Low') ? 'bottom center' : 'top center'
          ),
          textfont: { color: '#e2e8f0', size: 9, family: 'monospace' },
          marker: {
            color: ms.keypoints.map((k) =>
              k.label.includes('Bottom') || k.label.includes('Low') ? '#f59e0b' : '#c084fc'
            ),
            size: 7,
            symbol: 'circle',
            line: { color: '#090d16', width: 1.5 },
          },
          yaxis: 'y',
          showlegend: false,
          hovertemplate: '<b>%{text}</b>: $%{y:.2f}<extra></extra>',
        });
      }

      // Anchor trace on right edge so Plotly y-axis auto-range ALWAYS includes Buy Point & 5% Buy Zone
      if (dates.length > 0) {
        const lastDate = dates[dates.length - 1];
        traces.push({
          x: [lastDate, lastDate],
          y: [ms.buy_point, ms.buy_zone_high],
          type: 'scatter',
          mode: 'markers',
          name: `🎯 MS Buy Pt ($${ms.buy_point.toFixed(2)})`,
          marker: {
            color: ['#10b981', '#34d399'],
            size: [8, 6],
            symbol: ['diamond', 'triangle-up'],
            line: { color: '#090d16', width: 1.2 },
          },
          yaxis: 'y',
          hovertemplate:
            `<b>🏆 ${ms.pattern_name}</b><br>` +
            `Official Buy Point: <b>$${ms.buy_point.toFixed(2)}</b><br>` +
            `5% Buy Zone: <b>$${ms.buy_point.toFixed(2)} – $${ms.buy_zone_high.toFixed(2)}</b><br>` +
            `-7.5% Stop Loss: <b>$${(ms.stop_loss || 0).toFixed(2)}</b><extra></extra>`,
        });
      }

      // MarketSurge 5% Buy Zone Green Shaded Box [buy_point, buy_zone_high]
      shapes.push({
        type: 'rect',
        xref: 'paper',
        x0: 0.52,
        x1: 1.0,
        yref: 'y',
        y0: ms.buy_point,
        y1: ms.buy_zone_high,
        fillcolor: 'rgba(16, 185, 129, 0.15)',
        line: { color: 'rgba(16, 185, 129, 0.6)', width: 1, dash: 'dot' },
        layer: 'below',
      });

      // Official MarketSurge Buy Point (Pivot) Horizontal Line
      shapes.push({
        type: 'line',
        xref: 'paper',
        x0: 0.30,
        x1: 1.0,
        yref: 'y',
        y0: ms.buy_point,
        y1: ms.buy_point,
        line: { color: '#10b981', width: 2.2, dash: 'dash' },
      });

      annotations.push({
        xref: 'paper',
        x: 0.995,
        yref: 'y',
        y: ms.buy_point,
        text: `🎯 MS Buy Pt: $${ms.buy_point.toFixed(2)} (5% Buy Zone: $${ms.buy_zone_high.toFixed(2)})`,
        showarrow: false,
        xanchor: 'right',
        yanchor: 'bottom',
        font: { color: '#10b981', size: 10, family: 'monospace' },
        bgcolor: 'rgba(6, 78, 59, 0.92)',
        bordercolor: 'rgba(16, 185, 129, 0.7)',
        borderpad: 3,
      });

      // MarketSurge -7.5% Hard Stop Loss Line & Label
      if (ms.stop_loss > 0) {
        shapes.push({
          type: 'line',
          xref: 'paper',
          x0: 0.62,
          x1: 1.0,
          yref: 'y',
          y0: ms.stop_loss,
          y1: ms.stop_loss,
          line: { color: 'rgba(239, 68, 68, 0.7)', width: 1.4, dash: 'dot' },
        });
        annotations.push({
          xref: 'paper',
          x: 0.995,
          yref: 'y',
          y: ms.stop_loss,
          text: `🛑 MS -7.5% Stop: $${ms.stop_loss.toFixed(2)}`,
          showarrow: false,
          xanchor: 'right',
          yanchor: 'top',
          font: { color: '#f87171', size: 9, family: 'monospace' },
          bgcolor: 'rgba(69, 10, 10, 0.85)',
          bordercolor: 'rgba(239, 68, 68, 0.5)',
          borderpad: 2,
        });
      }
    }

    // =========================================================================
    // PANE 2: INSTITUTIONAL VOLUME HISTOGRAM + 50-BAR VOLUME SMA
    // =========================================================================
    const volColors = candles.map((c) => {
      if (c.is_pocket_pivot) return '#00f2fe'; // Electric Cyan for Pocket Pivot Volume
      if (c.is_vdu) return '#fbbf24'; // Amber Gold for Volume Dry-Up
      return c.is_up ? 'rgba(16, 185, 129, 0.65)' : 'rgba(239, 68, 68, 0.65)';
    });

    traces.push({
      x: dates,
      y: vols,
      type: 'bar',
      name: 'Volume',
      marker: { color: volColors },
      yaxis: 'y2',
      hovertemplate: 'Vol: %{y:,}<extra></extra>',
    });

    traces.push({
      x: dates,
      y: volSma50,
      type: 'scatter',
      mode: 'lines',
      name: '50-Bar Vol Avg',
      line: { color: '#f59e0b', width: 1.3 },
      yaxis: 'y2',
      hovertemplate: '50 Vol SMA: %{y:,.0f}<extra></extra>',
    });

    // =========================================================================
    // PANE 3: IBD RELATIVE STRENGTH LINE (vs SPY) + RS 21-EMA + BLUE DOTS
    // =========================================================================
    if (!isFullPriceOnly && Array.isArray(data.rs_series) && data.rs_series.length > 0) {
      traces.push({
        x: data.rs_series.map((r) => r.time),
        y: data.rs_series.map((r) => r.value),
        type: 'scatter',
        mode: 'lines',
        name: 'IBD RS Line (vs SPY)',
        line: { color: '#00E676', width: 2.0 },
        yaxis: 'y3',
        hovertemplate: 'IBD RS: %{y:.2f}<extra></extra>',
      });

      traces.push({
        x: data.rs_series.map((r) => r.time),
        y: data.rs_series.map((r) => r.ema21),
        type: 'scatter',
        mode: 'lines',
        name: 'RS 21-EMA',
        line: { color: '#38bdf8', width: 1.2, dash: 'dot' },
        yaxis: 'y3',
        hovertemplate: 'RS 21-EMA: %{y:.2f}<extra></extra>',
      });

      if (Array.isArray(data.blue_dots) && data.blue_dots.length > 0) {
        traces.push({
          x: data.blue_dots.map((b) => b.time),
          y: data.blue_dots.map((b) => b.rs_value),
          type: 'scatter',
          mode: 'markers',
          name: '🔵 RS Blue Dot',
          marker: {
            color: '#00E676',
            size: 7.5,
            symbol: 'circle',
            line: { color: '#ffffff', width: 1.2 },
          },
          yaxis: 'y3',
          showlegend: false,
          hovertemplate: '<b>🔵 RS Blue Dot</b>: %{y:.2f}<extra></extra>',
        });
      }
    }

    // =========================================================================
    // PANE 4: SELECTABLE MOMENTUM / VOLATILITY OSCILLATOR
    // =========================================================================
    let pane4Title = 'TTM Sqz';
    if (!isFullPriceOnly) {
      if (oscMode === 'ttm_squeeze') {
        pane4Title = 'TTM Squeeze';
        const sqzColors = candles.map((c) => {
          if (c.sqz_mom >= 0) return c.sqz_rising ? '#00f2fe' : '#3b82f6';
          return c.sqz_rising ? '#f59e0b' : '#ef4444';
        });
        traces.push({
          x: dates,
          y: candles.map((c) => c.sqz_mom),
          type: 'bar',
          name: 'Squeeze Momentum',
          marker: { color: sqzColors },
          yaxis: 'y4',
          hovertemplate: 'Sqz Mom: %{y:.3f}<extra></extra>',
        });
        traces.push({
          x: dates,
          y: candles.map(() => 0),
          type: 'scatter',
          mode: 'markers',
          name: 'Squeeze Dots (Red=Coiled)',
          marker: {
            color: candles.map((c) => (c.squeeze_on ? '#ef4444' : '#10b981')),
            size: 5.5,
            symbol: 'circle',
          },
          yaxis: 'y4',
          hovertemplate: '%{text}<extra></extra>',
          text: candles.map((c) => (c.squeeze_on ? '🔴 SQUEEZE ON (BB Inside KC)' : '🟢 SQUEEZE RELEASED')),
        });
      } else if (oscMode === 'macd') {
        pane4Title = 'MACD (12,26,9)';
        traces.push({
          x: dates,
          y: candles.map((c) => c.macd_hist),
          type: 'bar',
          name: 'MACD Hist',
          marker: {
            color: candles.map((c) =>
              c.macd_hist >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'
            ),
          },
          yaxis: 'y4',
          hovertemplate: 'MACD Hist: %{y:.3f}<extra></extra>',
        });
        traces.push({
          x: dates,
          y: candles.map((c) => c.macd),
          type: 'scatter',
          mode: 'lines',
          name: 'MACD',
          line: { color: '#38bdf8', width: 1.6 },
          yaxis: 'y4',
          hovertemplate: 'MACD: %{y:.3f}<extra></extra>',
        });
        traces.push({
          x: dates,
          y: candles.map((c) => c.macd_signal),
          type: 'scatter',
          mode: 'lines',
          name: 'Signal (9)',
          line: { color: '#f59e0b', width: 1.4 },
          yaxis: 'y4',
          hovertemplate: 'Signal: %{y:.3f}<extra></extra>',
        });
      } else if (oscMode === 'rsi') {
        pane4Title = 'RSI (14)';
        traces.push({
          x: dates,
          y: candles.map((c) => c.rsi14),
          type: 'scatter',
          mode: 'lines',
          name: 'RSI (14)',
          line: { color: '#c084fc', width: 1.8 },
          yaxis: 'y4',
          hovertemplate: 'RSI (14): %{y:.1f}<extra></extra>',
        });
        traces.push({
          x: dates,
          y: candles.map((c) => c.rsi_sma14),
          type: 'scatter',
          mode: 'lines',
          name: 'RSI SMA (14)',
          line: { color: '#fbbf24', width: 1.2, dash: 'dot' },
          yaxis: 'y4',
          hovertemplate: 'RSI SMA: %{y:.1f}<extra></extra>',
        });
        [30, 50, 70].forEach((lvl) => {
          shapes.push({
            type: 'line',
            xref: 'paper',
            x0: 0,
            x1: 1,
            yref: 'y4',
            y0: lvl,
            y1: lvl,
            line: {
              color: lvl === 50 ? 'rgba(148,163,184,0.35)' : 'rgba(192,132,252,0.3)',
              width: 1,
              dash: 'dot',
            },
          });
        });
      } else if (oscMode === 'adx') {
        pane4Title = 'ADX (14) & ±DI';
        traces.push({
          x: dates,
          y: candles.map((c) => c.adx14),
          type: 'scatter',
          mode: 'lines',
          name: 'ADX (14)',
          line: { color: '#fbbf24', width: 2.0 },
          yaxis: 'y4',
          hovertemplate: 'ADX: %{y:.1f}<extra></extra>',
        });
        traces.push({
          x: dates,
          y: candles.map((c) => c.plus_di),
          type: 'scatter',
          mode: 'lines',
          name: '+DI (14)',
          line: { color: '#10b981', width: 1.4 },
          yaxis: 'y4',
          hovertemplate: '+DI: %{y:.1f}<extra></extra>',
        });
        traces.push({
          x: dates,
          y: candles.map((c) => c.minus_di),
          type: 'scatter',
          mode: 'lines',
          name: '-DI (14)',
          line: { color: '#ef4444', width: 1.4 },
          yaxis: 'y4',
          hovertemplate: '-DI: %{y:.1f}<extra></extra>',
        });
        [20, 25].forEach((lvl) => {
          shapes.push({
            type: 'line',
            xref: 'paper',
            x0: 0,
            x1: 1,
            yref: 'y4',
            y0: lvl,
            y1: lvl,
            line: { color: 'rgba(251, 191, 36, 0.35)', width: 1, dash: 'dot' },
          });
        });
      }
    }

    const computedHeight = isFullscreen ? Math.max(580, (window.innerHeight || viewportHeight) - 128) : 710;
    const measuredWrapWidth = canvasWrapRef.current ? canvasWrapRef.current.clientWidth : containerWidth;
    const computedWidth = isFullscreen
      ? Math.max(800, window.innerWidth || viewportWidth)
      : measuredWrapWidth > 200
      ? measuredWrapWidth
      : undefined;
    const uiRevKey = `${data.ticker || ticker}_${data.timeframe || '1D'}_${data.range || '1Y'}_${paneLayout}_${logScale}_${isFullscreen ? 'fs' : 'dock'}`;

    const layout = {
      autosize: true,
      width: computedWidth,
      height: computedHeight,
      uirevision: uiRevKey,
      dragmode: 'pan',
      paper_bgcolor: '#070b12',
      plot_bgcolor: '#070b12',
      margin: { t: 28, r: 64, l: 52, b: 28 },
      hovermode: 'x unified',
      showlegend: true,
      legend: {
        orientation: 'h',
        yanchor: 'bottom',
        y: 1.005,
        xanchor: 'left',
        x: 0,
        font: { color: '#94a3b8', size: 10, family: 'monospace' },
        bgcolor: 'rgba(7, 11, 18, 0.7)',
      },
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
        nticks: 11,
      },
      // PANE 1: Price Action (82% in Full Price mode, or 57% in 4-Pane mode)
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
        autorange: true,
        domain: isFullPriceOnly ? [0.18, 1.0] : [0.43, 1.0],
      },
      // PANE 2: Volume & Footprints
      yaxis2: {
        uirevision: uiRevKey,
        title: { text: 'Volume', font: { color: '#64748b', size: 9.5 } },
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
            // PANE 3: IBD RS Line vs SPY (14% to 26%)
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
            // PANE 4: Active Momentum / Volatility Oscillator (0% to 12%)
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
      newshape: {
        line: { color: '#38bdf8', width: 2 },
      },
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      scrollZoom: true,
      displaylogo: false,
    };

    const renderPlot = () => {
      if (!plotRef.current || !window.Plotly) return;
      const liveW = isFullscreen
        ? window.innerWidth
        : canvasWrapRef.current?.clientWidth || plotRef.current?.clientWidth || computedWidth;
      if (liveW && liveW > 200) {
        layout.width = liveW;
      }
      window.Plotly.react(plotRef.current, traces, layout, config);
      requestAnimationFrame(() => {
        if (plotRef.current && window.Plotly) {
          window.Plotly.Plots.resize(plotRef.current);
        }
      });
      setTimeout(() => {
        if (plotRef.current && window.Plotly) {
          window.Plotly.Plots.resize(plotRef.current);
        }
      }, 60);

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
  }, [chartPayload, overlays, oscMode, logScale, isFullscreen, paneLayout, viewportHeight, viewportWidth, containerWidth]);

  const activeBar = hoveredBar || (chartPayload?.candles ? chartPayload.candles[chartPayload.candles.length - 1] : null);
  const sm = chartPayload?.summary_metrics || {};

  const handleFsTickerSearch = (e) => {
    e.preventDefault();
    const sym = fsSearchInput.trim().toUpperCase();
    if (!sym) return;
    if (typeof onSelectTicker === 'function') {
      onSelectTicker(sym);
    }
    setFsSearchInput('');
  };

  const chartNode = (
    <div
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
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
      {/* 0. DEDICATED FULL-CHART HEADER BAR (VISIBLE WHEN EXPANDED TO FULLSCREEN) */}
      {isFullscreen && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.6rem',
            padding: '0.45rem 0.9rem',
            background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.98), rgba(9, 13, 22, 0.98))',
            borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '1.25rem',
                fontWeight: 900,
                color: '#ffffff',
                fontFamily: 'monospace',
                letterSpacing: '0.03em',
              }}
            >
              🖥️ {ticker} FULL CHART
            </span>
            {sm.last_price > 0 && (
              <span style={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                ${sm.last_price.toFixed(2)}{' '}
                <span
                  style={{
                    fontSize: '0.78rem',
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
            {chartPayload?.trend_diagnostics && (
              <>
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: '5px',
                    background: `${chartPayload.trend_diagnostics.stage_color || '#10b981'}22`,
                    border: `1px solid ${chartPayload.trend_diagnostics.stage_color || '#10b981'}66`,
                    color: chartPayload.trend_diagnostics.stage_color || '#10b981',
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                  }}
                >
                  🏛️ {chartPayload.trend_diagnostics.stage_label}
                </span>
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: '5px',
                    background: 'rgba(56, 189, 248, 0.16)',
                    border: '1px solid rgba(56, 189, 248, 0.45)',
                    color: '#38bdf8',
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                  }}
                >
                  📍 {chartPayload.trend_diagnostics.maturity_phase}
                </span>
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: '5px',
                    background: `${chartPayload.trend_diagnostics.verdict_color || '#f59e0b'}22`,
                    border: `1px solid ${chartPayload.trend_diagnostics.verdict_color || '#f59e0b'}66`,
                    color: chartPayload.trend_diagnostics.verdict_color || '#f59e0b',
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                  }}
                >
                  {chartPayload.trend_diagnostics.verdict_short}
                </span>
              </>
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
                      padding: '2px 7px',
                      borderRadius: '4px',
                      border: isCurr ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.2)',
                      background: isCurr ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 6, 23, 0.6)',
                      color: isCurr ? '#38bdf8' : '#cbd5e1',
                      fontSize: '0.69rem',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {typeof onSelectTicker === 'function' && (
              <form onSubmit={handleFsTickerSearch} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(2, 6, 23, 0.8)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '5px',
                    padding: '2px 7px',
                  }}
                >
                  <Search size={12} color="#38bdf8" style={{ marginRight: '4px' }} />
                  <input
                    type="text"
                    value={fsSearchInput}
                    onChange={(e) => setFsSearchInput(e.target.value)}
                    placeholder="Switch ticker..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#f8fafc',
                      fontFamily: 'monospace',
                      fontSize: '0.73rem',
                      width: '115px',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '3px 8px',
                    borderRadius: '5px',
                    border: '1px solid #38bdf8',
                    background: 'rgba(56, 189, 248, 0.2)',
                    color: '#38bdf8',
                    fontSize: '0.71rem',
                    fontWeight: 800,
                    cursor: 'pointer',
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
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                background: 'rgba(239, 68, 68, 0.16)',
                color: '#f87171',
                fontSize: '0.73rem',
                fontWeight: 800,
                fontFamily: 'monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Minimize2 size={13} /> Exit Full Chart (ESC)
            </button>
          </div>
        </div>
      )}

      {/* 1. TOP INSTITUTIONAL CHART CONTROL BAR */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.45rem',
          padding: '0.5rem 0.75rem',
          background: 'rgba(15, 23, 42, 0.92)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
        }}
      >
        {/* Timeframe & Range Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, marginRight: '4px', textTransform: 'uppercase' }}>
            TF
          </span>
          {TIMEFRAME_PRESETS.map((p) => {
            const active = tfPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setTfPreset(p.id)}
                style={{
                  padding: '3px 7px',
                  fontSize: '0.71rem',
                  fontFamily: 'monospace',
                  fontWeight: active ? 800 : 600,
                  borderRadius: '5px',
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

        {/* Institutional Overlay Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { key: 'marketsurgePattern', label: '🏆 MarketSurge Buy Pt', color: '#c084fc' },
            { key: 'maRibbon', label: '📈 MA Ribbon', color: '#f59e0b' },
            { key: 'emaCloud', label: '☁️ 9/21 Cloud', color: '#10b981' },
            { key: 'volumeProfile', label: '📊 Vol Profile (POC/VA)', color: '#38bdf8' },
            { key: 'gexWalls', label: '🛡️ GEX Walls', color: '#a855f7' },
            { key: 'vcpAndFootprints', label: '⚡ VCP / PP / VDU', color: '#00f2fe' },
            { key: 'tradePlanZones', label: '🎯 R:R Target Box', color: '#34d399' },
            { key: 'bollinger', label: '🟣 BB (20,2)', color: '#c084fc' },
          ].map((ov) => {
            const isOn = overlays[ov.key];
            return (
              <button
                key={ov.key}
                type="button"
                onClick={() => toggleOverlay(ov.key)}
                style={{
                  padding: '3px 7px',
                  fontSize: '0.69rem',
                  fontWeight: isOn ? 700 : 500,
                  borderRadius: '5px',
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

        {/* Lower Pane 4 Oscillator Selector + Layout Mode + Log + Full Chart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {!isFullPriceOnly &&
            OSCILLATOR_MODES.map((m) => {
              const isSel = oscMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setOscMode(m.id)}
                  style={{
                    padding: '3px 7px',
                    fontSize: '0.69rem',
                    fontWeight: isSel ? 700 : 500,
                    borderRadius: '5px',
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

          {/* 4-Pane vs Full Price Canvas Switch */}
          <button
            type="button"
            onClick={() => handleSetPaneLayout(isFullPriceOnly ? '4pane' : 'full_price')}
            style={{
              padding: '3px 8px',
              fontSize: '0.69rem',
              fontFamily: 'monospace',
              fontWeight: 800,
              borderRadius: '5px',
              border: isFullPriceOnly ? '1px solid #10b981' : '1px solid rgba(148,163,184,0.22)',
              background: isFullPriceOnly ? 'rgba(16, 185, 129, 0.18)' : 'rgba(2, 6, 23, 0.5)',
              color: isFullPriceOnly ? '#10b981' : '#cbd5e1',
              cursor: 'pointer',
            }}
            title="Switch between 4-Pane Quant Sub-Panes vs Giant Full-Height Price + Volume Canvas"
          >
            {isFullPriceOnly ? '📊 Show 4-Pane' : '📈 Max Price'}
          </button>

          <button
            type="button"
            onClick={() => setLogScale((s) => !s)}
            style={{
              padding: '3px 7px',
              fontSize: '0.69rem',
              fontFamily: 'monospace',
              fontWeight: 700,
              borderRadius: '5px',
              border: logScale ? '1px solid #fbbf24' : '1px solid rgba(148,163,184,0.16)',
              background: logScale ? 'rgba(251, 191, 36, 0.18)' : 'rgba(2, 6, 23, 0.45)',
              color: logScale ? '#fbbf24' : '#94a3b8',
              cursor: 'pointer',
            }}
            title="Toggle Logarithmic vs Linear Price Scale"
          >
            LOG
          </button>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            style={{
              padding: '3px 9px',
              borderRadius: '5px',
              border: '1px solid rgba(56, 189, 248, 0.55)',
              background: isFullscreen ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.18)',
              color: isFullscreen ? '#f87171' : '#38bdf8',
              fontSize: '0.7rem',
              fontFamily: 'monospace',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title={isFullscreen ? 'Exit Fullscreen (ESC)' : 'Expand to Full-Screen Chart (100vw × 100vh)'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {isFullscreen ? 'Exit Full' : 'Full Chart'}
          </button>
        </div>
      </div>

      {/* 2. LIVE CROSSHAIR OHLCV + MOVING AVERAGE TELEMETRY RIBBON (FIXED 32PX HEIGHT — NEVER JUMPS) */}
      {activeBar && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'nowrap',
            whiteSpace: 'nowrap',
            overflowX: 'auto',
            height: '32px',
            minHeight: '32px',
            maxHeight: '32px',
            gap: '0.6rem',
            padding: '0 0.75rem',
            background: 'rgba(9, 13, 22, 0.96)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
            fontFamily: 'monospace',
            fontSize: '0.71rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'nowrap', flexShrink: 0 }}>
            <span style={{ color: '#94a3b8', fontWeight: 700 }}>{activeBar.time}</span>
            <span>
              O: <strong style={{ color: '#e2e8f0' }}>${activeBar.open?.toFixed(2)}</strong>
            </span>
            <span>
              H: <strong style={{ color: '#10b981' }}>${activeBar.high?.toFixed(2)}</strong>
            </span>
            <span>
              L: <strong style={{ color: '#ef4444' }}>${activeBar.low?.toFixed(2)}</strong>
            </span>
            <span>
              C:{' '}
              <strong style={{ color: activeBar.is_up ? '#10b981' : '#ef4444' }}>
                ${activeBar.close?.toFixed(2)}
              </strong>
            </span>
            <span>
              Vol:{' '}
              <strong style={{ color: activeBar.rvol >= 1.5 ? '#00f2fe' : '#cbd5e1' }}>
                {(activeBar.value / 1e6).toFixed(2)}M ({activeBar.rvol}x)
              </strong>
            </span>
            <span>
              CLV:{' '}
              <strong style={{ color: activeBar.clv >= 65 ? '#10b981' : activeBar.clv <= 35 ? '#ef4444' : '#cbd5e1' }}>
                {activeBar.clv}%
              </strong>
            </span>
            {chartPayload?.marketsurge?.buy_point > 0 && (() => {
              const distPct = chartPayload.marketsurge.distance_to_pivot_pct ?? chartPayload.marketsurge.dist_to_pivot_pct ?? 0;
              return (
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: 'rgba(192, 132, 252, 0.16)',
                    border: '1px solid rgba(192, 132, 252, 0.45)',
                    color: '#c084fc',
                    fontWeight: 800,
                  }}
                >
                  🏆 {chartPayload.marketsurge.pattern_name} · Buy Pt: ${chartPayload.marketsurge.buy_point.toFixed(2)} ({distPct >= 0 ? '+' : ''}{distPct}%)
                </span>
              );
            })()}
            {activeBar.is_pocket_pivot && (
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: 'rgba(0, 242, 254, 0.16)',
                  border: '1px solid rgba(0, 242, 254, 0.5)',
                  color: '#00f2fe',
                  fontWeight: 800,
                }}
              >
                ⚡ PP
              </span>
            )}
            {activeBar.is_vdu && (
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: 'rgba(251, 191, 36, 0.16)',
                  border: '1px solid rgba(251, 191, 36, 0.5)',
                  color: '#fbbf24',
                  fontWeight: 800,
                }}
              >
                💧 VDU
              </span>
            )}
            {activeBar.squeeze_on && (
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid rgba(239, 68, 68, 0.55)',
                  color: '#f87171',
                  fontWeight: 800,
                }}
              >
                🔴 SQZ
              </span>
            )}
          </div>

          {/* Live Moving Average Values at Hovered Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'nowrap', flexShrink: 0 }}>
            {activeBar.ema9 && (
              <span style={{ color: '#38bdf8' }}>9EMA: ${activeBar.ema9.toFixed(2)}</span>
            )}
            {activeBar.ema21 && (
              <span style={{ color: '#10b981' }}>21EMA: ${activeBar.ema21.toFixed(2)}</span>
            )}
            {activeBar.sma50 && (
              <span style={{ color: '#f59e0b' }}>50SMA: ${activeBar.sma50.toFixed(2)}</span>
            )}
            {activeBar.sma150 && (
              <span style={{ color: '#a855f7' }}>150SMA: ${activeBar.sma150.toFixed(2)}</span>
            )}
            {activeBar.sma200 && (
              <span style={{ color: '#ef4444' }}>200SMA: ${activeBar.sma200.toFixed(2)}</span>
            )}
            <span style={{ color: '#c084fc' }}>RSI: {activeBar.rsi14}</span>
            <span style={{ color: '#fbbf24' }}>ADX: {activeBar.adx14}</span>
          </div>
        </div>
      )}

      {/* 3. SYNCHRONIZED 4-PANE PLOTLY CANVAS */}
      <div ref={canvasWrapRef} style={{ flex: 1, width: '100%', minHeight: '640px', position: 'relative' }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              zIndex: 10,
              background: 'rgba(7, 11, 18, 0.82)',
            }}
          >
            <Loader size={30} className="spin" style={{ marginBottom: '0.75rem' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
              Synthesizing {ticker} ({activePresetObj.label}) Institutional Chart &amp; GEX Surface...
            </span>
          </div>
        )}

        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              zIndex: 10,
              background: 'rgba(7, 11, 18, 0.9)',
              padding: '1.5rem',
            }}
          >
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Failed to Load Institutional Chart</span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '6px' }}>{error}</span>
            <button
              type="button"
              onClick={fetchChartData}
              style={{
                marginTop: '12px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #38bdf8',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Retry Fetch
            </button>
          </div>
        )}

        <div ref={plotRef} style={{ width: '100%', height: '100%', minHeight: '640px' }} />
      </div>
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(chartNode, document.body);
  }
  return chartNode;
}
