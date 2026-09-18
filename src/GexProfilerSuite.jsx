import React, { useState, useEffect, useMemo, useRef } from 'react';
import './GexProfiler.css';
import {
  Loader2, Zap, Target, TrendingUp, TrendingDown,
  Activity, Compass, Layers, AlertCircle, ArrowUpRight,
  ArrowDownRight, CheckCircle2, Sliders, Info, Eye,
  ChevronDown, ChevronUp, Crosshair, Shield, Sparkles,
  Filter, ArrowRight, ShieldCheck, Check, Maximize2,
  Bot, Cpu, Brain, Flame, Search, RefreshCw, BarChart2,
  AlertTriangle, Briefcase, ChevronRight, Camera, Copy
} from 'lucide-react';
import {
  ComposedChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ReferenceLine, ResponsiveContainer,
  Line, Area, Legend
} from 'recharts';

export default function GexProfilerSuite({ initialTicker = 'SPY' }) {
  const [ticker, setTicker] = useState(initialTicker || 'SPY');
  const [searchInput, setSearchInput] = useState('');
  const [selectedExpiry, setSelectedExpiry] = useState('ALL');
  const [activeChartMode, setActiveChartMode] = useState('spotgamma_trace'); // 'spotgamma_trace' | 'delta_charm_map' | 'net_gex' | 'call_put_split' | 'vanna_vex' | 'term_structure' | 'price_projection' | 'oi_heatmap' | 'cumulative'
  const [traceLens, setTraceLens] = useState('gex'); // 'gex' | 'dex' | 'cex'
  const [traceDistributionMode, setTraceDistributionMode] = useState('combined'); // 'combined' | 'call_put_split' | 'net_gex' | 'abs_gex' | 'curve'
  const [matrixLens, setMatrixLens] = useState('dex'); // 'dex' | 'cex' | 'gex' | 'vex'
  const [showTraceGuide, setShowTraceGuide] = useState(true);
  const [oiVolSubMode, setOiVolSubMode] = useState('both'); // 'both' | 'volume' | 'oi'
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [plotlyReady, setPlotlyReady] = useState(false);
  const [hedgeHeatmapViewMode, setHedgeHeatmapViewMode] = useState('visual'); // 'visual' | 'table'
  const [hedgeHeatmapLens, setHedgeHeatmapLens] = useState('combined'); // 'combined' | 'dex' | 'cex'
  const [heatmapSmoothMode, setHeatmapSmoothMode] = useState('smooth'); // 'smooth' | 'discrete'
  const [heatmapStrikeRange, setHeatmapStrikeRange] = useState(0.10); // 0.05 | 0.10 | 0.20 | 1.0
  const [heatmapShowKeyLevels, setHeatmapShowKeyLevels] = useState(true);
  const [copiedZoneKey, setCopiedZoneKey] = useState(null);
  const hedgePlotRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const quickTickers = ['SPY', 'QQQ', 'NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMD', 'SMCI'];

  const fetchGex = async (targetTicker, expiry = 'ALL') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gex?ticker=${targetTicker}&expiry=${expiry}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load GEX data:', err);
      setError(err.message || 'Failed to fetch options dealer gamma data');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGex(ticker, selectedExpiry);
  }, [ticker, selectedExpiry]);

  // Ensure Plotly is ready for visual 2D heatmap rendering
  useEffect(() => {
    if (!window.Plotly) {
      const script = document.createElement('script');
      script.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
      script.async = true;
      script.onload = () => setPlotlyReady(true);
      document.body.appendChild(script);
    } else {
      setPlotlyReady(true);
    }
  }, []);



  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    const clean = searchInput.trim().toUpperCase();
    setTicker(clean);
    setSearchInput('');
  };

  // Extract key analytics from backend payload
  const spot = data?.spot_price || 0;
  const keyLevels = data?.key_levels || {};
  const totals = data?.totals || {};
  const regime = data?.regime || {};
  const pillars = data?.pillars || [];
  const tradeSetup = data?.trade_setup || {};
  const expirations = data?.expirations || [];
  const rawProfile = data?.gex_profile || [];
  const expectedMove = data?.expected_move || null;
  const riskScores = data?.risk_scores || null;
  const greekProjection = data?.greek_projection || null;
  const termStructure = data?.term_structure || [];
  const matrixData = data?.matrix_data || [];
  const spotgammaTrace = data?.spotgamma_trace || null;
  const deltaMatrix = data?.delta_matrix || [];
  const charmMatrix = data?.charm_matrix || [];
  // Resilient Options Hedging Impact & Tail-Wags-The-Dog Engine
  const optionsImpact = useMemo(() => {
    if (data?.options_hedging_impact && data.options_hedging_impact.breakdown_chart_data && data.options_hedging_impact.breakdown_chart_data.length > 0) {
      return data.options_hedging_impact;
    }
    if (!data || !data.spot_price) return null;

    // Client-side synthesis fallback from totals, spot, and expected move
    const spotVal = Number(data.spot_price) || 100;
    const netGexVal = Math.abs(Number(data.totals?.total_net_gex) || 0);
    const netCexVal = Math.abs(Number(data.totals?.total_net_cex) || 0);
    const callOiVal = Number(data.totals?.total_call_oi) || 35000;
    const putOiVal = Number(data.totals?.total_put_oi) || 35000;
    const adtvVal = Number(data.adtv) || (data.totals?.total_call_oi ? (callOiVal + putOiVal) * 8 : 25000000);

    const movePctVal = Number(expectedMove?.move_1d_pct) || 1.4;
    const gammaShares = spotVal > 0 ? (netGexVal / spotVal) * (movePctVal / 1.0) : 0;
    const flowDeltaShares = (callOiVal + putOiVal) * 12;
    const callFlowShares = callOiVal * 12;
    const putFlowShares = putOiVal * 12;
    const charmShares = spotVal > 0 ? netCexVal / spotVal : 0;
    const totalHedgingShares = flowDeltaShares + gammaShares + charmShares;

    const ratio = adtvVal > 0 ? Math.round((totalHedgingShares / adtvVal) * 1000) / 10 : 38.5;
    const impactLevel = ratio >= 35 ? 'HIGH' : (ratio >= 15 ? 'MODERATE' : 'LOW');
    const impactBadge = impactLevel === 'HIGH' ? 'OPTIONS DOMINANT' : (impactLevel === 'MODERATE' ? 'MODERATE IMPACT' : 'EQUITY DOMINANT');
    const impactColor = impactLevel === 'HIGH' ? '#00F0FF' : (impactLevel === 'MODERATE' ? '#00E676' : '#94a3b8');
    const verdict = impactLevel === 'HIGH' ? 'YES · SEVERELY IMPACTED' : (impactLevel === 'MODERATE' ? 'YES · MODERATELY IMPACTED' : 'NO · CASH EQUITY DRIVEN');

    return {
      is_options_impacted: impactLevel !== 'LOW',
      verdict,
      impact_level: impactLevel,
      impact_title: impactLevel === 'HIGH' ? 'TAIL WAGS THE DOG · SEVERE OPTIONS DOMINANCE' : (impactLevel === 'MODERATE' ? 'BALANCED MARKET · ACTIVE OPTIONS INFLUENCE' : 'CASH EQUITY DRIVEN · MINIMAL OPTIONS IMPACT'),
      impact_badge: impactBadge,
      impact_color: impactColor,
      impact_summary: `Options market makers generate ~${ratio}% of daily share turnover (${Math.round(totalHedgingShares).toLocaleString()} shares/day vs ADTV ${Math.round(adtvVal).toLocaleString()}). Stock price action is heavily dictated by options dealer delta/gamma hedging, pin levels, and walls.`,
      trading_implication: impactLevel !== 'LOW'
        ? 'Strong gravitational pull to Call Wall, Put Wall, and Max Pain. Dips and rallies are amplified or pinned by market maker hedging. Pure equity fundamentals take a back seat.'
        : 'Options hedging has minimal control over price action. Dealer walls are porous. Rely primarily on Volume Profile, VWAP, price technicals, and fundamental order flow.',
      hedging_volume_ratio_pct: ratio,
      hedging_today_ratio_pct: ratio,
      total_options_hedging_shares: Math.round(totalHedgingShares),
      flow_delta_shares: Math.round(flowDeltaShares),
      call_delta_flow_shares: Math.round(callFlowShares),
      put_delta_flow_shares: Math.round(putFlowShares),
      gamma_rehedging_shares: Math.round(gammaShares),
      charm_decay_shares: Math.round(charmShares),
      net_directional_delta_shares: Math.round(flowDeltaShares * 0.12),
      net_directional_bias: `NET DEALER DIP BUYING (+${Math.round((flowDeltaShares * 0.12) / 1000)}K shs)`,
      adtv_shares: Math.round(adtvVal),
      latest_stock_vol: Math.round(adtvVal),
      options_notional_m: Number(((totalHedgingShares * spotVal) / 1e6).toFixed(1)),
      stock_dollar_adtv_m: Number(((adtvVal * spotVal) / 1e6).toFixed(1)),
      options_notional_ratio: Number((totalHedgingShares / adtvVal).toFixed(2)),
      breakdown_chart_data: [
        { category: 'Stock ADTV (20D)', shares: Math.round(adtvVal), shares_millions: Number((adtvVal / 1e6).toFixed(2)), type: 'stock_volume', color: '#64748b' },
        { category: 'Total Options Hedging', shares: Math.round(totalHedgingShares), shares_millions: Number((totalHedgingShares / 1e6).toFixed(2)), type: 'hedging_total', color: impactColor },
        { category: 'Flow Delta Hedging', shares: Math.round(flowDeltaShares), shares_millions: Number((flowDeltaShares / 1e6).toFixed(2)), type: 'component', color: '#38bdf8' },
        { category: 'Gamma Movement Rebalance', shares: Math.round(gammaShares), shares_millions: Number((gammaShares / 1e6).toFixed(2)), type: 'component', color: '#c084fc' },
        { category: 'Charm Overnight Decay', shares: Math.round(charmShares), shares_millions: Number((charmShares / 1e6).toFixed(2)), type: 'component', color: '#fbbf24' }
      ]
    };
  }, [data, expectedMove]);

  const formatShares = (val) => {
    if (val === undefined || val === null) return '0';
    const absVal = Math.abs(val);
    if (absVal >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
    if (absVal >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
    if (absVal >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
    return `${Number(val).toLocaleString()}`;
  };

  // 1-Click Snapshot Export Function
  const handleExportHeatmap = () => {
    if (!hedgePlotRef.current || !window.Plotly) return;
    try {
      window.Plotly.downloadImage(hedgePlotRef.current, {
        format: 'png',
        width: 1400,
        height: 820,
        filename: `${ticker}_delta_charm_hedge_pressure_map`
      });
    } catch (err) {
      console.warn('Failed to export heatmap snapshot:', err);
    }
  };

  // Render 2D Delta & Charm Hedge Pressure Heatmap (Price vs Time)
  useEffect(() => {
    if (activeChartMode !== 'delta_charm_map' || hedgeHeatmapViewMode !== 'visual') return;
    if (!hedgePlotRef.current || !window.Plotly) return;

    try {
      const hmap = data?.hedge_pressure_map;
      if (!hmap || !hmap.expirations || !hmap.strikes || hmap.strikes.length === 0) return;

      let zValues = hmap.combined_grid;
      let labelPrefix = 'Combined Hedge Flow';
      if (hedgeHeatmapLens === 'dex') {
        zValues = hmap.delta_grid;
        labelPrefix = 'Delta Pressure';
      } else if (hedgeHeatmapLens === 'cex') {
        zValues = hmap.charm_grid;
        labelPrefix = 'Charm Decay Drift';
      }

      if (!zValues || zValues.length === 0) return;

      // Filter strikes based on user-selected range (±5%, ±10%, ±20%, or Full 1.0)
      const spotVal = Number(hmap.spot_price || spot || 100);
      const rangePct = heatmapStrikeRange;
      const strikeIndices = [];
      const filteredStrikes = [];
      hmap.strikes.forEach((st, idx) => {
        if (rangePct >= 0.99 || Math.abs(st - spotVal) / (spotVal || 1) <= rangePct) {
          strikeIndices.push(idx);
          filteredStrikes.push(st);
        }
      });

      const activeStrikes = filteredStrikes.length > 0 ? filteredStrikes : hmap.strikes;
      const activeZ = (filteredStrikes.length > 0 ? strikeIndices.map(i => zValues[i]) : zValues) || [];

      // Construct custom rich hover text matrix with explicit Buy / Sell directives
      const hoverText = activeStrikes.map((st, sIdx) => {
        return hmap.expirations.map((exp, eIdx) => {
          const val = activeZ[sIdx]?.[eIdx] || 0;
          const isBuy = val >= 0;
          const actionStr = isBuy 
            ? '🟢 DEALER BUY ZONE (Support Floor · Buy Stocks / Calls)' 
            : '🔴 DEALER SELL ZONE (Resistance Ceiling · Sell / Short / Trim)';
          const valFormatted = `${val >= 0 ? '+' : ''}$${val.toFixed(1)}M`;
          const distPct = (((st - spotVal) / spotVal) * 100).toFixed(1);
          return `<b>Strike Price: $${st}</b> (${distPct >= 0 ? '+' : ''}${distPct}% from Spot)<br>` +
                 `Time / Expiry: <b>${exp}</b><br>` +
                 `${labelPrefix}: <b>${valFormatted}</b><br>` +
                 `<b>${actionStr}</b>`;
        });
      });

      const plotData = [
        {
          type: 'heatmap',
          x: hmap.expirations,
          y: activeStrikes,
          z: activeZ,
          text: hoverText,
          hoverinfo: 'text',
          zsmooth: heatmapSmoothMode === 'smooth' ? 'best' : false,
          colorscale: [
            [0.0, '#ef4444'],   // Heavy Sell Pressure (Red)
            [0.25, '#dc2626'],
            [0.40, '#991b1b'],
            [0.48, '#1e293b'],
            [0.5, '#0a0e17'],   // Equilibrium Zero Line (Dark Slate)
            [0.52, '#1e293b'],
            [0.60, '#065f46'],
            [0.75, '#059669'],
            [1.0, '#10b981']   // Heavy Buy Pressure (Emerald Green)
          ],
          zmid: 0,
          colorbar: {
            title: { text: 'Flow ($M)', font: { color: '#cbd5e1', family: 'monospace', size: 11 } },
            tickfont: { color: '#94a3b8', family: 'monospace', size: 10 },
            len: 0.85,
            thickness: 16
          }
        },
        // Spot Price Tracking Line across Expirations
        {
          type: 'scatter',
          mode: 'lines',
          name: `Current Spot ($${spotVal.toFixed(2)})`,
          x: hmap.expirations,
          y: hmap.expirations.map(() => spotVal),
          line: { color: '#ffffff', width: 2.2, dash: 'dash' },
          hoverinfo: 'name+y'
        }
      ];

      // Crucial Key Level: Zero Gamma Flip (Volatility Regime Boundary)
      if (keyLevels?.zero_gamma && heatmapShowKeyLevels) {
        plotData.push({
          type: 'scatter',
          mode: 'lines',
          name: `Zero Gamma ($${keyLevels.zero_gamma})`,
          x: hmap.expirations,
          y: hmap.expirations.map(() => keyLevels.zero_gamma),
          line: { color: '#00F0FF', width: 2, dash: 'dashdot' },
          hoverinfo: 'name+y'
        });
      }

      if (keyLevels?.call_wall && heatmapShowKeyLevels) {
        plotData.push({
          type: 'scatter',
          mode: 'lines',
          name: `Call Wall ($${keyLevels.call_wall})`,
          x: hmap.expirations,
          y: hmap.expirations.map(() => keyLevels.call_wall),
          line: { color: '#f43f5e', width: 1.8, dash: 'dot' },
          hoverinfo: 'name+y'
        });
      }

      if (keyLevels?.put_wall && heatmapShowKeyLevels) {
        plotData.push({
          type: 'scatter',
          mode: 'lines',
          name: `Put Wall ($${keyLevels.put_wall})`,
          x: hmap.expirations,
          y: hmap.expirations.map(() => keyLevels.put_wall),
          line: { color: '#00E676', width: 1.8, dash: 'dot' },
          hoverinfo: 'name+y'
        });
      }

      // Beacon Pin: Top #1 Institutional Buy Zone
      const topBuy = hmap.top_buy_zones?.[0];
      if (topBuy && hmap.expirations.includes(topBuy.expiry)) {
        plotData.push({
          type: 'scatter',
          mode: 'markers+text',
          name: `⭐ #1 Buy Floor ($${topBuy.strike})`,
          x: [topBuy.expiry],
          y: [topBuy.strike],
          text: [`⭐ BUY CUSHION (+$${topBuy.combined_pressure_m}M)`],
          textposition: 'top center',
          textfont: { family: 'monospace', size: 10, color: '#00E676' },
          marker: {
            symbol: 'star-diamond',
            size: 13,
            color: '#00E676',
            line: { color: '#ffffff', width: 1.5 }
          },
          hoverinfo: 'text'
        });
      }

      // Beacon Pin: Top #1 Institutional Sell Wall
      const topSell = hmap.top_sell_zones?.[0];
      if (topSell && hmap.expirations.includes(topSell.expiry)) {
        plotData.push({
          type: 'scatter',
          mode: 'markers+text',
          name: `⚡ #1 Sell Resistance ($${topSell.strike})`,
          x: [topSell.expiry],
          y: [topSell.strike],
          text: [`⚡ SELL RESISTANCE (-$${Math.abs(topSell.combined_pressure_m)}M)`],
          textposition: 'bottom center',
          textfont: { family: 'monospace', size: 10, color: '#ff3366' },
          marker: {
            symbol: 'diamond',
            size: 13,
            color: '#ff3366',
            line: { color: '#ffffff', width: 1.5 }
          },
          hoverinfo: 'text'
        });
      }

      const annotations = [];
      if (heatmapShowKeyLevels) {
        annotations.push({
          xref: 'paper',
          x: 1.005,
          y: spotVal,
          yref: 'y',
          text: `<b>SPOT $${spotVal.toFixed(1)}</b>`,
          showarrow: false,
          font: { color: '#0a0e17', size: 9, family: 'monospace' },
          bgcolor: '#ffffff',
          borderpad: 3,
          xanchor: 'left'
        });
        if (keyLevels?.zero_gamma) {
          annotations.push({
            xref: 'paper',
            x: 1.005,
            y: keyLevels.zero_gamma,
            yref: 'y',
            text: `<b>FLIP $${keyLevels.zero_gamma}</b>`,
            showarrow: false,
            font: { color: '#040812', size: 9, family: 'monospace' },
            bgcolor: '#00F0FF',
            borderpad: 3,
            xanchor: 'left'
          });
        }
        if (keyLevels?.call_wall) {
          annotations.push({
            xref: 'paper',
            x: 1.005,
            y: keyLevels.call_wall,
            yref: 'y',
            text: `<b>CW $${keyLevels.call_wall}</b>`,
            showarrow: false,
            font: { color: '#ffffff', size: 9, family: 'monospace' },
            bgcolor: '#f43f5e',
            borderpad: 3,
            xanchor: 'left'
          });
        }
        if (keyLevels?.put_wall) {
          annotations.push({
            xref: 'paper',
            x: 1.005,
            y: keyLevels.put_wall,
            yref: 'y',
            text: `<b>PW $${keyLevels.put_wall}</b>`,
            showarrow: false,
            font: { color: '#040812', size: 9, family: 'monospace' },
            bgcolor: '#00E676',
            borderpad: 3,
            xanchor: 'left'
          });
        }
      }

      const layout = {
        paper_bgcolor: '#060910',
        plot_bgcolor: '#0a0e17',
        margin: { l: 75, r: 85, t: 30, b: 65 },
        annotations: annotations,
        xaxis: {
          title: { text: 'Time / Expirations (Chronological OpEx Horizon)', font: { color: '#94a3b8', family: 'monospace', size: 11 } },
          tickfont: { color: '#cbd5e1', family: 'monospace', size: 10 },
          gridcolor: 'rgba(255, 255, 255, 0.05)'
        },
        yaxis: {
          title: { text: 'Price / Strike Price ($)', font: { color: '#94a3b8', family: 'monospace', size: 11 } },
          tickfont: { color: '#cbd5e1', family: 'monospace', size: 10 },
          gridcolor: 'rgba(255, 255, 255, 0.05)'
        },
        showlegend: true,
        legend: {
          x: 0.01,
          y: 1.10,
          orientation: 'h',
          font: { color: '#cbd5e1', family: 'monospace', size: 10 },
          bgcolor: 'rgba(10, 14, 23, 0.75)'
        }
      };

      window.Plotly.newPlot(hedgePlotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
    } catch (e) {
      console.warn('Plotly render error:', e);
    }
  }, [activeChartMode, hedgeHeatmapViewMode, hedgeHeatmapLens, heatmapSmoothMode, heatmapStrikeRange, heatmapShowKeyLevels, data, spot, keyLevels, plotlyReady]);

  // Telemetry metrics for Delta & Charm Hedge Pressure Map
  const hmapData = data?.hedge_pressure_map;
  const totBuy = hmapData?.total_buy_pressure_m || 0;
  const totSell = hmapData?.total_sell_pressure_m || 0;
  const totFlow = totBuy + totSell;
  const buyPct = totFlow > 0 ? Math.round((totBuy / totFlow) * 100) : 50;
  const sellPct = 100 - buyPct;
  const netDealerBiasM = Math.round((totBuy - totSell) * 10) / 10;

  // Find equilibrium strike where combined row total is closest to 0
  const equilibriumStrike = useMemo(() => {
    if (!hmapData?.strikes || !hmapData?.combined_grid) return null;
    let closestStrike = null;
    let minDiff = Infinity;
    hmapData.strikes.forEach((st, idx) => {
      const rowSum = (hmapData.combined_grid[idx] || []).reduce((a, b) => a + b, 0);
      if (Math.abs(rowSum) < minDiff) {
        minDiff = Math.abs(rowSum);
        closestStrike = st;
      }
    });
    return closestStrike;
  }, [hmapData]);

  // Filter strikes within ±12% of spot for high-definition chart visualization
  const filteredProfile = useMemo(() => {
    if (!rawProfile.length || !spot) return rawProfile;
    const lower = spot * 0.88;
    const upper = spot * 1.12;
    const filtered = rawProfile.filter(p => p.strike >= lower && p.strike <= upper);
    return filtered.length > 0 ? filtered : rawProfile;
  }, [rawProfile, spot]);

  // Find the exact closest strike on categorical X-axes to guarantee Recharts ReferenceLine always renders
  const closestStrikeToSpot = useMemo(() => {
    if (!filteredProfile || filteredProfile.length === 0 || !spot) return null;
    const closest = filteredProfile.reduce((prev, curr) => 
      Math.abs(curr.strike - spot) < Math.abs(prev.strike - spot) ? curr : prev
    );
    return closest ? closest.strike : null;
  }, [filteredProfile, spot]);

  // Check if Open Interest is populated or if clearing is in progress
  const hasOiData = useMemo(() => {
    return (rawProfile || []).some(p => (p.call_oi || 0) > 0 || (p.put_oi || 0) > 0);
  }, [rawProfile]);

  // Construct trajectory series including T=0 Spot origin for cone visualization
  const projectionChartData = useMemo(() => {
    if (!greekProjection?.trajectory_series || !spot) return [];
    const startPoint = {
      day: 0,
      label: 'Now',
      base_target: Number(spot.toFixed(2)),
      upper_1sigma: Number(spot.toFixed(2)),
      lower_1sigma: Number(spot.toFixed(2)),
      upper_2sigma: Number(spot.toFixed(2)),
      lower_2sigma: Number(spot.toFixed(2)),
      call_wall: keyLevels.call_wall,
      put_wall: keyLevels.put_wall,
      pin_anchor: greekProjection?.pin_equilibrium_anchor || spot,
    };
    return [startPoint, ...greekProjection.trajectory_series];
  }, [greekProjection, spot, keyLevels]);

  // Format Large Values ($ Millions / Billions)
  const formatDollarGex = (val) => {
    if (val === undefined || val === null) return '$0';
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '+';
    if (absVal >= 1e9) return `${sign}$${(absVal / 1e9).toFixed(2)}B`;
    if (absVal >= 1e6) return `${sign}$${(absVal / 1e6).toFixed(1)}M`;
    if (absVal >= 1e3) return `${sign}$${(absVal / 1e3).toFixed(0)}K`;
    return `${sign}$${absVal.toFixed(0)}`;
  };

  return (
    <div className="gex-root">
      
      {/* ===================================================================== */}
      {/* 1. MASTER TERMINAL COMMAND & TICKER RIBBON                            */}
      {/* ===================================================================== */}
      <div className="gex-header-banner">
        <div className="gex-header-glow" />

        <div className="gex-header-top-row">
          {/* Identity Left */}
          <div className="gex-identity-wrap">
            <div className="gex-logo-box">
              <Zap style={{ width: '22px', height: '22px', color: '#00F0FF' }} />
            </div>
            <div className="gex-titles-block">
              <h1>
                {ticker} <span className="gex-badge-tag">GEX TERMINAL</span>
              </h1>
              <p className="gex-subtitle">
                Institutional Gamma Exposure Profiler · Real-time Market Maker Delta Hedging & Pin Analytics
              </p>
            </div>
          </div>

          {/* Controls Right */}
          <div className="gex-controls-wrap">
            <div className="gex-quick-chips">
              {quickTickers.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTicker(t)}
                  className={`gex-chip-btn ${ticker === t ? 'active' : ''}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="gex-search-form">
              <input
                type="text"
                placeholder="Lookup (e.g. NVDA)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                className="gex-search-input"
              />
              <button type="submit" className="gex-search-btn">
                Scan GEX
              </button>
            </form>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={44} color="#00F0FF" style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <p style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', fontSize: '13px' }}>
            Aggregating multi-expiration options chains & computing dealer gamma surfaces for {ticker}...
          </p>
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: '24px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#f43f5e', fontFamily: 'JetBrains Mono, monospace' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertCircle size={18} />
            <strong>Options Data Ingestion Error</strong>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#fca5a5' }}>{error}</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* ===================================================================== */}
          {/* 2. EXECUTIVE AI DEALER GAMMA INTELLIGENCE HERO                        */}
          {/* ===================================================================== */}
          <div className="gex-ai-hero-card">
            <div className="gex-ai-glow-cyan" />
            <div className="gex-ai-glow-purple" />

            <div className="gex-ai-header">
              <div className="gex-ai-titles-left">
                <div className="gex-ai-icon-box">
                  <Brain style={{ width: '22px', height: '22px', color: '#00F0FF' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2>Quant AI Dealer Gamma Intelligence · {ticker} Positioning</h2>
                    <span className="gex-ai-tag">
                      <Sparkles style={{ width: '12px', height: '12px' }} />
                      LIVE POSITIONING
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Multi-expiry Black-Scholes gamma surface · Zero-gamma crossover, dealer pinning & squeeze risk modeling
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {expectedMove && (
                  <div className="gex-em-pill">
                    <span className="gex-em-label">1D EXPECTED MOVE:</span>
                    <span className="gex-em-val">±${expectedMove.move_1d} ({expectedMove.move_1d_pct}%)</span>
                    <span className="gex-em-range">[{expectedMove.range_1d[0]} – {expectedMove.range_1d[1]}]</span>
                  </div>
                )}
                {optionsImpact && (
                  <div className="gex-impact-pill" style={{
                    borderColor: optionsImpact.impact_color ? `${optionsImpact.impact_color}66` : 'rgba(0, 240, 255, 0.4)',
                    backgroundColor: optionsImpact.impact_color ? `${optionsImpact.impact_color}15` : 'rgba(0, 240, 255, 0.1)',
                    color: optionsImpact.impact_color || '#00F0FF'
                  }}>
                    <Zap size={13} />
                    <span style={{ fontWeight: 800 }}>{optionsImpact.impact_badge}:</span>
                    <span>{optionsImpact.hedging_volume_ratio_pct}% of ADTV</span>
                  </div>
                )}
                <div className="gex-ai-posture-pill" style={{
                  color: regime.color || '#00F0FF',
                  borderColor: regime.color ? `${regime.color}66` : 'rgba(6, 182, 212, 0.4)',
                  backgroundColor: regime.color ? `${regime.color}15` : 'rgba(6, 182, 212, 0.15)'
                }}>
                  {regime.badge || 'DEALER REGIME'}
                </div>
              </div>
            </div>

            {/* Verdict Hero Box with Dual Risk Meters */}
            <div className="gex-ai-verdict-box" style={{
              borderColor: regime.color ? `${regime.color}55` : 'rgba(6, 182, 212, 0.3)',
              background: regime.color 
                ? `linear-gradient(135deg, ${regime.color}14 0%, rgba(15, 23, 42, 0.95) 100%)`
                : 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(168, 85, 247, 0.06) 60%, rgba(15, 23, 42, 0.9) 100%)'
            }}>
              <div className="gex-ai-verdict-text">
                <span className="gex-ai-verdict-badge" style={{
                  color: regime.color || '#ffffff',
                  borderColor: regime.color ? `${regime.color}66` : 'rgba(255, 255, 255, 0.18)',
                  backgroundColor: regime.color ? `${regime.color}22` : 'rgba(255, 255, 255, 0.1)'
                }}>{regime.badge}</span>
                <h3 className="gex-ai-verdict-title" style={{ color: regime.color || '#ffffff' }}>{regime.title}</h3>
                <p className="gex-ai-verdict-summary">{regime.summary}</p>
              </div>

              {/* Quantitative Risk Dial Gauges: Squeeze & Pin Risk */}
              {riskScores && (
                <div className="gex-risk-meters-wrap">
                  {/* Gauge 1: Gamma Squeeze */}
                  <div className="gex-risk-gauge">
                    <div className="gex-risk-gauge-top">
                      <span className="gex-risk-title">SQUEEZE RISK</span>
                      <Flame size={14} color={riskScores.squeeze_color} />
                    </div>
                    <div className="gex-risk-score-num" style={{ color: riskScores.squeeze_color }}>
                      {riskScores.squeeze_score}<span style={{ fontSize: '11px', color: '#64748b' }}>/100</span>
                    </div>
                    <div className="gex-risk-bar-track">
                      <div
                        className="gex-risk-bar-fill"
                        style={{
                          width: `${riskScores.squeeze_score}%`,
                          backgroundColor: riskScores.squeeze_color
                        }}
                      />
                    </div>
                    <span className="gex-risk-rating" style={{ color: riskScores.squeeze_color }}>
                      {riskScores.squeeze_rating}
                    </span>
                  </div>

                  {/* Gauge 2: Pin Probability */}
                  <div className="gex-risk-gauge">
                    <div className="gex-risk-gauge-top">
                      <span className="gex-risk-title">PIN RISK</span>
                      <Target size={14} color={riskScores.pin_color} />
                    </div>
                    <div className="gex-risk-score-num" style={{ color: riskScores.pin_color }}>
                      {riskScores.pin_score}<span style={{ fontSize: '11px', color: '#64748b' }}>/100</span>
                    </div>
                    <div className="gex-risk-bar-track">
                      <div
                        className="gex-risk-bar-fill"
                        style={{
                          width: `${riskScores.pin_score}%`,
                          backgroundColor: riskScores.pin_color
                        }}
                      />
                    </div>
                    <span className="gex-risk-rating" style={{ color: riskScores.pin_color }}>
                      {riskScores.pin_rating}
                    </span>
                  </div>

                  {/* Gauge 3: Downside Cascade Risk */}
                  <div className="gex-risk-gauge">
                    <div className="gex-risk-gauge-top">
                      <span className="gex-risk-title">CASCADE RISK</span>
                      <TrendingDown size={14} color={riskScores.cascade_color || '#f43f5e'} />
                    </div>
                    <div className="gex-risk-score-num" style={{ color: riskScores.cascade_color || '#f43f5e' }}>
                      {riskScores.cascade_score || 0}<span style={{ fontSize: '11px', color: '#64748b' }}>/100</span>
                    </div>
                    <div className="gex-risk-bar-track">
                      <div
                        className="gex-risk-bar-fill"
                        style={{
                          width: `${riskScores.cascade_score || 0}%`,
                          backgroundColor: riskScores.cascade_color || '#f43f5e'
                        }}
                      />
                    </div>
                    <span className="gex-risk-rating" style={{ color: riskScores.cascade_color || '#f43f5e' }}>
                      {riskScores.cascade_rating || 'LOW RISK'}
                    </span>
                  </div>
                </div>
              )}

              {/* Gamma Range Corridor Preview Box */}
              <div className="gex-corridor-box">
                <div className="gex-corridor-top">
                  <span>Current Spot Price</span>
                  <span style={{ color: '#00F0FF', fontWeight: 700 }}>Real-Time Feed</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span className="gex-corridor-num">${spot.toFixed(2)}</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: spot >= keyLevels.zero_gamma ? '#00E676' : '#f43f5e', fontWeight: 800 }}>
                    {spot >= keyLevels.zero_gamma ? '▲ Above Flip' : '▼ Below Flip'}
                  </span>
                </div>
                <div className="gex-corridor-targets">
                  <span>Put Wall: <strong style={{ color: '#f43f5e' }}>${keyLevels.put_wall}</strong></span>
                  <span>Flip: <strong style={{ color: '#00F0FF' }}>${keyLevels.zero_gamma}</strong></span>
                  <span>Call Wall: <strong style={{ color: '#00E676' }}>${keyLevels.call_wall}</strong></span>
                </div>
              </div>
            </div>

            {/* 4-Pillar Diagnostic Grid */}
            <div className="gex-pillars-grid">
              {pillars.map((pillar) => {
                const borderClass = `border-${pillar.color}`;
                return (
                  <div key={pillar.id} className={`gex-pillar-card ${borderClass}`}>
                    <div>
                      <div className="gex-pillar-header">
                        <span className="gex-pillar-title">{pillar.title}</span>
                        <span className={`gex-pillar-status ${pillar.color}`}>{pillar.status}</span>
                      </div>
                      <div className={`gex-pillar-metric ${pillar.color}`}>
                        {pillar.metric}
                      </div>
                      <p className="gex-pillar-takeaway">
                        {pillar.takeaway}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ================================================================= */}
            {/* 2B. OPTIONS HEDGING IMPACT & TAIL-WAGS-THE-DOG ANALYZER           */}
            {/* ================================================================= */}
            {optionsImpact && (
              <div className="gex-options-impact-card" style={{
                borderColor: optionsImpact.impact_color ? `${optionsImpact.impact_color}44` : 'rgba(0, 240, 255, 0.25)'
              }}>
                <div className="gex-options-impact-header">
                  <div className="gex-impact-header-left">
                    <div className="gex-impact-icon-box" style={{ background: `${optionsImpact.impact_color}18`, borderColor: `${optionsImpact.impact_color}44` }}>
                      <Zap style={{ width: '20px', height: '20px', color: optionsImpact.impact_color }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 className="gex-impact-title">
                          Options Market Dominance & Dealer Hedging Impact
                        </h3>
                        <span className="gex-impact-badge" style={{
                          backgroundColor: `${optionsImpact.impact_color}22`,
                          color: optionsImpact.impact_color,
                          borderColor: `${optionsImpact.impact_color}55`
                        }}>
                          {optionsImpact.impact_badge}
                        </span>
                      </div>
                      <p className="gex-impact-subtitle">
                        Quantifies whether {ticker} share volume is dictated by options market maker delta/gamma hedging vs underlying cash equity flow
                      </p>
                    </div>
                  </div>

                  <div className="gex-impact-verdict-pill" style={{
                    borderColor: `${optionsImpact.impact_color}66`,
                    backgroundColor: `${optionsImpact.impact_color}14`,
                    color: optionsImpact.impact_color
                  }}>
                    <span className="lbl">HEDGING IMPACT VERDICT:</span>
                    <span className="val">{optionsImpact.verdict}</span>
                  </div>
                </div>

                {/* Meter and Progress Bar */}
                <div className="gex-impact-meter-container">
                  <div className="gex-impact-meter-top">
                    <span className="meter-label">Options Hedging Share of Daily Volume (ADTV):</span>
                    <span className="meter-val" style={{ color: optionsImpact.impact_color }}>
                      {optionsImpact.hedging_volume_ratio_pct}%
                      <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>
                        ({formatShares(optionsImpact.total_options_hedging_shares)} / {formatShares(optionsImpact.adtv_shares)} ADTV)
                      </span>
                    </span>
                  </div>

                  {/* Multi-tier gradient progress bar */}
                  <div className="gex-impact-track">
                    <div
                      className="gex-impact-fill"
                      style={{
                        width: `${Math.min(100, Math.max(4, optionsImpact.hedging_volume_ratio_pct))}%`,
                        backgroundColor: optionsImpact.impact_color,
                        boxShadow: `0 0 12px ${optionsImpact.impact_color}66`
                      }}
                    />
                    <div className="gex-impact-marker" style={{ left: '15%' }}>
                      <span className="marker-tag">15% Moderate</span>
                    </div>
                    <div className="gex-impact-marker" style={{ left: '35%' }}>
                      <span className="marker-tag">35% Tail Wags Dog</span>
                    </div>
                  </div>

                  <div className="gex-impact-scale-labels">
                    <span>0% Cash Equity Driven</span>
                    <span>15% Active Options Flow</span>
                    <span>35%+ Severe Dealer Dominance (Tail Wags Dog)</span>
                  </div>
                </div>

                {/* 5-Stat Comparison Metric Grid */}
                <div className="gex-impact-stats-grid">
                  <div className="gex-impact-stat-card">
                    <span className="stat-label">Daily Options Hedging Vol</span>
                    <div className="stat-val" style={{ color: optionsImpact.impact_color }}>
                      {formatShares(optionsImpact.total_options_hedging_shares)}
                    </div>
                    <span className="stat-sub">{optionsImpact.hedging_volume_ratio_pct}% of 20D ADTV</span>
                  </div>

                  <div className="gex-impact-stat-card">
                    <span className="stat-label">Flow Delta Hedging</span>
                    <div className="stat-val cyan">
                      {formatShares(optionsImpact.flow_delta_shares)}
                    </div>
                    <span className="stat-sub">Direct contract trade turnover</span>
                  </div>

                  <div className="gex-impact-stat-card">
                    <span className="stat-label">Gamma Dynamic Rebalance</span>
                    <div className="stat-val purple">
                      {formatShares(optionsImpact.gamma_rehedging_shares)}
                    </div>
                    <span className="stat-sub">Per 1D expected move (±${expectedMove?.move_1d || '---'})</span>
                  </div>

                  <div className="gex-impact-stat-card">
                    <span className="stat-label">Net Dealer Flow Bias</span>
                    <div className="stat-val" style={{ color: optionsImpact.net_directional_delta_shares >= 0 ? '#00E676' : '#f43f5e', fontSize: '13px' }}>
                      {optionsImpact.net_directional_bias}
                    </div>
                    <span className="stat-sub">Directional delta imbalance</span>
                  </div>

                  <div className="gex-impact-stat-card">
                    <span className="stat-label">Options / Stock Notional</span>
                    <div className="stat-val amber">
                      {optionsImpact.options_notional_ratio}x
                    </div>
                    <span className="stat-sub">${optionsImpact.options_notional_m}M Opts vs ${optionsImpact.stock_dollar_adtv_m}M Stock</span>
                  </div>
                </div>

                {/* Actionable Microstructure Takeaway */}
                <div className="gex-impact-takeaway-box">
                  <div className="takeaway-title">
                    <Info size={14} color={optionsImpact.impact_color} />
                    <span>Microstructure Playbook & Trading Impact:</span>
                  </div>
                  <p className="takeaway-text">
                    {optionsImpact.impact_summary}
                  </p>
                  <p className="takeaway-guidance">
                    <strong>Rulebook: </strong>{optionsImpact.trading_implication}
                  </p>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* 3. QUANT AI ENTRY & POSITION ARCHITECTURE DECK                    */}
            {/* ================================================================= */}
            {data?.trade_setup && (
              <div className="gex-entry-plan-card">
                <div className="gex-entry-plan-header">
                  <div className="gex-entry-plan-title-box">
                    <div className="gex-entry-icon-box">
                      <Target style={{ width: '18px', height: '18px', color: '#00E676' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 className="gex-entry-main-heading">
                          Quant AI Dealer Execution Plan · {tradeSetup.setup_name}
                        </h4>
                        <span className={`gex-entry-badge ${tradeSetup.bias_color || 'emerald'}`}>
                          <Sparkles style={{ width: '10px', height: '10px' }} />
                          {tradeSetup.bias || 'GEX TRIGGER'}
                        </span>
                      </div>
                      <p className="gex-entry-subheading">
                        {tradeSetup.strategy_name ? `${tradeSetup.strategy_name} · ` : ''}
                        Algorithmic entries anchored to dealer hedging flip points, Call/Put walls, and OpEx pin gravitational magnets
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {tradeSetup.sizing_recommendation && (
                      <div className="gex-entry-allocation-pill" style={{ borderColor: 'rgba(0, 230, 118, 0.3)', color: '#00E676' }}>
                        <ShieldCheck style={{ width: '13px', height: '13px', color: '#00E676' }} />
                        <span>{tradeSetup.sizing_recommendation}</span>
                      </div>
                    )}
                    <div className="gex-entry-allocation-pill">
                      <Briefcase style={{ width: '13px', height: '13px', color: '#00F0FF' }} />
                      <span>R/R {tradeSetup.risk_reward || '1:3.0'} {tradeSetup.risk_reward_t2 ? `(T2: ${tradeSetup.risk_reward_t2})` : ''}</span>
                    </div>
                  </div>
                </div>

                <div className="gex-entry-metrics-grid">
                  {/* 1. Optimal Trigger / Accumulation Corridor */}
                  <div className="gex-entry-tile primary">
                    <div className="gex-entry-tile-top">
                      <span className="label">Accumulation Corridor</span>
                      <span className="tag green">ENTRY</span>
                    </div>
                    <div className="gex-entry-val green" style={{ fontSize: tradeSetup.entry_range ? '15px' : '18px' }}>
                      {tradeSetup.entry_range
                        ? `$${tradeSetup.entry_range[0]} ── $${tradeSetup.entry_range[1]}`
                        : `$${tradeSetup.ideal_entry}`}
                    </div>
                    <div className="gex-entry-sub">
                      Spot: ${spot.toFixed(2)} {tradeSetup.entry_range && spot >= tradeSetup.entry_range[0] && spot <= tradeSetup.entry_range[1] ? '🎯 In Corridor' : ''}
                    </div>
                  </div>

                  {/* 2. Structural Invalidation Sentinel */}
                  <div className="gex-entry-tile">
                    <div className="gex-entry-tile-top">
                      <span className="label">Invalidation Stop</span>
                      <span className="tag rose">STOP LOSS</span>
                    </div>
                    <div className="gex-entry-val rose">
                      ${tradeSetup.stop_loss}
                    </div>
                    <div className="gex-entry-sub">
                      Risk: {tradeSetup.stop_loss_pct !== undefined ? `${tradeSetup.stop_loss_pct}%` : `-${Math.abs(((tradeSetup.ideal_entry - tradeSetup.stop_loss) / tradeSetup.ideal_entry) * 100).toFixed(1)}%`}
                    </div>
                  </div>

                  {/* 3. Primary Pin Target */}
                  <div className="gex-entry-tile">
                    <div className="gex-entry-tile-top">
                      <span className="label">Target 1 (Pin)</span>
                      <span className="tag emerald">TRIM 50%</span>
                    </div>
                    <div className="gex-entry-val emerald">
                      ${tradeSetup.target_primary}
                    </div>
                    <div className="gex-entry-sub" style={{ color: '#00E676' }}>
                      +{tradeSetup.target_primary_pct !== undefined ? `${tradeSetup.target_primary_pct}%` : Math.abs(((tradeSetup.target_primary - tradeSetup.ideal_entry) / tradeSetup.ideal_entry) * 100).toFixed(1)}% Gain
                    </div>
                  </div>

                  {/* 4. Secondary Target Runner */}
                  <div className="gex-entry-tile">
                    <div className="gex-entry-tile-top">
                      <span className="label">Secondary Target</span>
                      <span className="tag purple">RUNNER</span>
                    </div>
                    <div className="gex-entry-val purple">
                      ${tradeSetup.target_secondary}
                    </div>
                    <div className="gex-entry-sub" style={{ color: '#c084fc' }}>
                      +{tradeSetup.target_secondary_pct !== undefined ? `${tradeSetup.target_secondary_pct}%` : ''} Trailing
                    </div>
                  </div>

                  {/* 5. Options Structure */}
                  <div className="gex-entry-tile">
                    <div className="gex-entry-tile-top">
                      <span className="label">Options Contract</span>
                      <span className="tag cyan">STRATEGY</span>
                    </div>
                    <div className="gex-entry-val cyan" style={{ fontSize: '11px', lineHeight: '1.4', marginTop: '4px' }}>
                      {tradeSetup.options_spec || tradeSetup.strategy_name || 'Vertical Spread'}
                    </div>
                    <div className="gex-entry-sub">
                      Horizon: {tradeSetup.expected_holding || '3-8 Days'}
                    </div>
                  </div>

                  {/* 6. Asymmetry & Sizing */}
                  <div className="gex-entry-tile">
                    <div className="gex-entry-tile-top">
                      <span className="label">Quant Asymmetry</span>
                      <span className="tag amber">R:R EDGE</span>
                    </div>
                    <div className="gex-entry-val amber">
                      {tradeSetup.risk_reward}
                    </div>
                    <div className="gex-entry-sub">
                      Max Pain: ${tradeSetup.max_pain_pin || '---'}
                    </div>
                  </div>
                </div>

                {/* 5-Phase Execution Checklist */}
                {tradeSetup.execution_checklist && tradeSetup.execution_checklist.length > 0 && (
                  <div className="gex-checklist-box">
                    <div className="gex-checklist-header">
                      <div className="gex-checklist-title">
                        <CheckCircle2 style={{ width: '15px', height: '15px', color: '#00F0FF' }} />
                        <span>5-Phase Institutional Execution Protocol</span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                        Rigorous Invalidation & Scale-Out Discipline
                      </span>
                    </div>
                    <div className="gex-checklist-grid">
                      {tradeSetup.execution_checklist.map((step, idx) => (
                        <div key={idx} className="gex-checklist-step">
                          <div className="step-badge">{idx + 1}</div>
                          <div className="step-content">
                            <span className="step-phase">{step.phase}</span>
                            <span className="step-detail">{step.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================================================================= */}
            {/* 3B. QUANTITATIVE GREEK PRICE PROJECTIONS (5D & 20D HORIZON)       */}
            {/* ================================================================= */}
            {greekProjection && (
              <div className="gex-projections-container">
                <div className="gex-projections-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="gex-proj-icon-box">
                      <TrendingUp style={{ width: '18px', height: '18px', color: '#00F0FF' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 className="gex-entry-main-heading">
                          Quantitative Greek Price Projections · 5-Day & 20-Day Model
                        </h4>
                        <span className="gex-ai-tag">
                          <Brain style={{ width: '10px', height: '10px' }} />
                          SDE JUMP-DIFFUSION
                        </span>
                      </div>
                      <p className="gex-entry-subheading">
                        Mathematical framework: Gamma-Attenuated Ornstein-Uhlenbeck Mean Reversion + Vanna Delta Drift Vector
                      </p>
                    </div>
                  </div>

                  <div className="gex-proj-vol-badge">
                    <Activity size={13} color="#c084fc" />
                    <span>Realized Vol Compression: {greekProjection.effective_realized_vol_pct}%</span>
                  </div>
                </div>

                {/* Dual Horizon Cards (5-Day & 20-Day) */}
                <div className="gex-horizons-grid">
                  {/* 5-Day Projection Card */}
                  <div className="gex-horizon-card">
                    <div className="gex-horizon-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="gex-horizon-badge cyan">5-DAY OUTLOOK</span>
                        <span className="gex-horizon-title">Next Week OpEx Pin</span>
                      </div>
                      <div className="gex-horizon-ret-pill" style={{ color: greekProjection.proj_5d.base_return_pct >= 0 ? '#00E676' : '#f43f5e' }}>
                        {greekProjection.proj_5d.base_return_pct >= 0 ? '+' : ''}{greekProjection.proj_5d.base_return_pct}% Exp Return
                      </div>
                    </div>

                    <div className="gex-horizon-main-target">
                      <span className="label">Projected Median Pin</span>
                      <div className="val cyan">${greekProjection.proj_5d.base_target}</div>
                      <span className="sub">Anchor: Max Pain ${greekProjection.pin_equilibrium_anchor}</span>
                    </div>

                    {/* Confidence Corridors */}
                    <div className="gex-conf-corridors">
                      <div className="gex-conf-row">
                        <span className="conf-label">68% Confidence (±1σ)</span>
                        <span className="conf-val">${greekProjection.proj_5d.lower_1sigma} ── ${greekProjection.proj_5d.upper_1sigma}</span>
                      </div>
                      <div className="gex-conf-row">
                        <span className="conf-label">95% Confidence (±2σ)</span>
                        <span className="conf-val">${greekProjection.proj_5d.lower_2sigma} ── ${greekProjection.proj_5d.upper_2sigma}</span>
                      </div>
                    </div>

                    {/* Scenarios Mini-Bar */}
                    <div className="gex-scenario-minibar">
                      <div className="scen-item">
                        <span className="scen-lbl">Bull Squeeze</span>
                        <span className="scen-val emerald">${greekProjection.proj_5d.bull_squeeze_target}</span>
                      </div>
                      <div className="scen-item">
                        <span className="scen-lbl">Base Pin</span>
                        <span className="scen-val cyan">${greekProjection.proj_5d.base_target}</span>
                      </div>
                      <div className="scen-item">
                        <span className="scen-lbl">Bear Cascade</span>
                        <span className="scen-val rose">${greekProjection.proj_5d.bear_cascade_target}</span>
                      </div>
                    </div>
                  </div>

                  {/* 20-Day Projection Card */}
                  <div className="gex-horizon-card">
                    <div className="gex-horizon-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="gex-horizon-badge purple">20-DAY OUTLOOK</span>
                        <span className="gex-horizon-title">Monthly OpEx Horizon</span>
                      </div>
                      <div className="gex-horizon-ret-pill" style={{ color: greekProjection.proj_20d.base_return_pct >= 0 ? '#00E676' : '#f43f5e' }}>
                        {greekProjection.proj_20d.base_return_pct >= 0 ? '+' : ''}{greekProjection.proj_20d.base_return_pct}% Exp Return
                      </div>
                    </div>

                    <div className="gex-horizon-main-target">
                      <span className="label">Projected Monthly Target</span>
                      <div className="val purple">${greekProjection.proj_20d.base_target}</div>
                      <span className="sub">Macro Wall Channel: ${keyLevels.put_wall} ── ${keyLevels.call_wall}</span>
                    </div>

                    {/* Confidence Corridors */}
                    <div className="gex-conf-corridors">
                      <div className="gex-conf-row">
                        <span className="conf-label">68% Confidence (±1σ)</span>
                        <span className="conf-val">${greekProjection.proj_20d.lower_1sigma} ── ${greekProjection.proj_20d.upper_1sigma}</span>
                      </div>
                      <div className="gex-conf-row">
                        <span className="conf-label">95% Confidence (±2σ)</span>
                        <span className="conf-val">${greekProjection.proj_20d.lower_2sigma} ── ${greekProjection.proj_20d.upper_2sigma}</span>
                      </div>
                    </div>

                    {/* Scenarios Mini-Bar */}
                    <div className="gex-scenario-minibar">
                      <div className="scen-item">
                        <span className="scen-lbl">Bull Squeeze</span>
                        <span className="scen-val emerald">${greekProjection.proj_20d.bull_squeeze_target}</span>
                      </div>
                      <div className="scen-item">
                        <span className="scen-lbl">Base Target</span>
                        <span className="scen-val purple">${greekProjection.proj_20d.base_target}</span>
                      </div>
                      <div className="scen-item">
                        <span className="scen-lbl">Bear Cascade</span>
                        <span className="scen-val rose">${greekProjection.proj_20d.bear_cascade_target}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3-Way Greek Scenario Probability Deck */}
                <div className="gex-scenario-cards-grid">
                  {greekProjection.scenarios.map((scen) => (
                    <div key={scen.id} className={`gex-scen-card border-${scen.color}`}>
                      <div className="gex-scen-card-top">
                        <span className="gex-scen-name">{scen.name}</span>
                        <span className={`gex-scen-prob-badge ${scen.color}`}>{scen.probability} Probability</span>
                      </div>
                      <div className="gex-scen-targets-row">
                        <div>
                          <span className="t-lbl">5D Target:</span>
                          <span className={`t-val ${scen.color}`}>{scen.target_5d}</span>
                        </div>
                        <div>
                          <span className="t-lbl">20D Target:</span>
                          <span className={`t-val ${scen.color}`}>{scen.target_20d}</span>
                        </div>
                      </div>
                      <p className="gex-scen-narrative">{scen.narrative}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* 4. KEY STRUCTURAL TELEMETRY STRIP                                     */}
          {/* ===================================================================== */}
          <div className="gex-kpis-strip">
            <div className="gex-kpi-tile">
              <span className="gex-kpi-label">Call Wall (Resistance)</span>
              <div className="gex-kpi-val" style={{ color: '#00E676' }}>
                ${keyLevels.call_wall}
              </div>
              <span className="gex-kpi-sub">Major overhead ceiling</span>
            </div>

            <div className="gex-kpi-tile">
              <span className="gex-kpi-label">Put Wall (Support)</span>
              <div className="gex-kpi-val" style={{ color: '#f43f5e' }}>
                ${keyLevels.put_wall}
              </div>
              <span className="gex-kpi-sub">Major downside support floor</span>
            </div>

            <div className="gex-kpi-tile">
              <span className="gex-kpi-label">Zero Gamma Flip Point</span>
              <div className="gex-kpi-val" style={{ color: '#00F0FF' }}>
                ${keyLevels.zero_gamma}
              </div>
              <span className="gex-kpi-sub">Volatility inflection line</span>
            </div>

            <div className="gex-kpi-tile">
              <span className="gex-kpi-label">Max Pain Strike</span>
              <div className="gex-kpi-val" style={{ color: '#fbbf24' }}>
                ${keyLevels.max_pain}
              </div>
              <span className="gex-kpi-sub">Maximum financial pain pin</span>
            </div>

            <div className="gex-kpi-tile">
              <span className="gex-kpi-label">Total Net Dollar Gamma</span>
              <div className="gex-kpi-val" style={{ color: totals.total_net_gex >= 0 ? '#00E676' : '#f43f5e' }}>
                {formatDollarGex(totals.total_net_gex)}
              </div>
              <span className="gex-kpi-sub">Dealer $ per 1% move</span>
            </div>

            <div className="gex-kpi-tile">
              <span className="gex-kpi-label">Put / Call OI Ratio</span>
              <div className="gex-kpi-val" style={{ color: totals.put_call_oi_ratio > 1.2 ? '#f43f5e' : (totals.put_call_oi_ratio < 0.8 ? '#00E676' : '#ffffff') }}>
                {totals.put_call_oi_ratio}x
              </div>
              <span className="gex-kpi-sub">
                {totals.put_call_oi_ratio > 1.2 ? 'Heavy Put Skew' : (totals.put_call_oi_ratio < 0.8 ? 'Heavy Call Skew' : 'Balanced Flow')}
              </span>
            </div>

            {optionsImpact && (
              <div className="gex-kpi-tile">
                <span className="gex-kpi-label">Options Hedging Share</span>
                <div className="gex-kpi-val" style={{ color: optionsImpact.impact_color || '#00F0FF' }}>
                  {optionsImpact.hedging_volume_ratio_pct}%
                </div>
                <span className="gex-kpi-sub">
                  {optionsImpact.impact_level === 'HIGH' ? '⚡ Tail Wags The Dog' : (optionsImpact.impact_level === 'MODERATE' ? '⚖️ Active Influence' : '📊 Equity Driven')}
                </span>
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* 5. INTERACTIVE GEX VISUALIZER DECK                                    */}
          {/* ===================================================================== */}
          <div className="gex-visualizer-card">
            <div className="gex-visualizer-header">
              <div className="gex-visualizer-left">
                <BarChart2 size={18} color="#00F0FF" />
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Interactive Gamma Exposure Surface & Distribution
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Filtered view (±12% from spot) across active strikes
                    </span>
                    <span className="gex-current-spot-pill">
                      📍 SPOT: <strong>${spot ? Number(spot).toFixed(2) : '---'}</strong>
                    </span>
                    {keyLevels.zero_gamma ? (
                      <span className="gex-flip-proximity-pill" style={{ color: spot >= keyLevels.zero_gamma ? '#00E676' : '#f43f5e' }}>
                        {spot >= keyLevels.zero_gamma ? '▲ +' : '▼ -'}{Math.abs(((spot - keyLevels.zero_gamma) / keyLevels.zero_gamma) * 100).toFixed(1)}% vs Flip (${keyLevels.zero_gamma})
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Mode Toggles & Expiration Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div className="gex-mode-toggles">
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('spotgamma_trace')}
                    className={`gex-mode-btn spotgamma-trace-btn ${activeChartMode === 'spotgamma_trace' ? 'active' : ''}`}
                  >
                    🎯 SpotGamma TRACE
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('delta_charm_map')}
                    className={`gex-mode-btn delta-charm-btn ${activeChartMode === 'delta_charm_map' ? 'active' : ''}`}
                  >
                    🗺️ Delta & Charm Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('options_impact')}
                    className={`gex-mode-btn options-impact-btn ${activeChartMode === 'options_impact' ? 'active' : ''}`}
                  >
                    ⚡ Hedging vs ADTV
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('net_gex')}
                    className={`gex-mode-btn ${activeChartMode === 'net_gex' ? 'active' : ''}`}
                  >
                    Net GEX
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('call_put_split')}
                    className={`gex-mode-btn ${activeChartMode === 'call_put_split' ? 'active' : ''}`}
                  >
                    Call vs Put GEX
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('vanna_vex')}
                    className={`gex-mode-btn ${activeChartMode === 'vanna_vex' ? 'active' : ''}`}
                  >
                    Net Vanna (VEX)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('term_structure')}
                    className={`gex-mode-btn ${activeChartMode === 'term_structure' ? 'active' : ''}`}
                  >
                    Term Structure
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('price_projection')}
                    className={`gex-mode-btn ${activeChartMode === 'price_projection' ? 'active' : ''}`}
                  >
                    5D & 20D Projections 🚀
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('oi_heatmap')}
                    className={`gex-mode-btn ${activeChartMode === 'oi_heatmap' ? 'active' : ''}`}
                  >
                    OI & Volume
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('cumulative')}
                    className={`gex-mode-btn ${activeChartMode === 'cumulative' ? 'active' : ''}`}
                  >
                    Cumulative GEX
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMatrixModal(!showMatrixModal)}
                  className={`gex-matrix-toggle-btn ${showMatrixModal ? 'active' : ''}`}
                >
                  <Layers size={13} />
                  {showMatrixModal ? 'Hide Matrix' : 'Strike × Expiry Matrix'}
                </button>

                {expirations.length > 0 && (
                  <select
                    value={selectedExpiry}
                    onChange={(e) => setSelectedExpiry(e.target.value)}
                    className="gex-expiry-select"
                  >
                    <option value="ALL">All Expirations (Full Chain)</option>
                    <option value="FRONT">Front Expiration (0-5 DTE)</option>
                    {expirations.map((exp) => (
                      <option key={exp} value={exp}>
                        Exp: {exp}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Interactive Chart Sub-Bar for OI & Volume */}
            {activeChartMode === 'oi_heatmap' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace' }}>VIEW MODE:</span>
                  <button
                    type="button"
                    onClick={() => setOiVolSubMode('both')}
                    style={{
                      background: oiVolSubMode === 'both' ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                      color: oiVolSubMode === 'both' ? '#000' : '#cbd5e1',
                      border: '1px solid ' + (oiVolSubMode === 'both' ? '#38bdf8' : 'rgba(255,255,255,0.1)'),
                      borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '11px', fontFamily: 'monospace'
                    }}
                  >
                    All (Volume & OI)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOiVolSubMode('volume')}
                    style={{
                      background: oiVolSubMode === 'volume' ? '#00E676' : 'rgba(255,255,255,0.06)',
                      color: oiVolSubMode === 'volume' ? '#000' : '#cbd5e1',
                      border: '1px solid ' + (oiVolSubMode === 'volume' ? '#00E676' : 'rgba(255,255,255,0.1)'),
                      borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '11px', fontFamily: 'monospace'
                    }}
                  >
                    Active Volume Flow
                  </button>
                  <button
                    type="button"
                    onClick={() => setOiVolSubMode('oi')}
                    style={{
                      background: oiVolSubMode === 'oi' ? '#818cf8' : 'rgba(255,255,255,0.06)',
                      color: oiVolSubMode === 'oi' ? '#000' : '#cbd5e1',
                      border: '1px solid ' + (oiVolSubMode === 'oi' ? '#818cf8' : 'rgba(255,255,255,0.1)'),
                      borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '11px', fontFamily: 'monospace'
                    }}
                  >
                    Open Interest (OI)
                  </button>
                </div>
                {(totals?.is_oi_clearing || !hasOiData) && (
                  <span style={{ color: '#fbbf24', fontSize: '11px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    ⚡ Pre-Market OCC Clearing: Displaying pending volume flow as Open Interest proxy until 9:00 AM ET OCC release.
                  </span>
                )}
              </div>
            )}

            {/* SPOTGAMMA TRACE SUB-TOOLBAR */}
            {activeChartMode === 'spotgamma_trace' && (
              <div className="gex-trace-subtoolbar">
                <div className="gex-trace-lens-group">
                  <span className="gex-trace-lens-label">
                    {traceLens === 'gex' ? 'GAMMA DISTRIBUTION:' : (traceLens === 'dex' ? 'DELTA PRESSURE DISTRIBUTION:' : 'CHARM DECAY DISTRIBUTION:')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTraceDistributionMode('combined')}
                    className={`gex-trace-lens-btn ${traceDistributionMode === 'combined' ? 'active' : ''}`}
                    title="Real Strike Bars + Overlaid Continuous Model Curve"
                  >
                    ⚡ Combined (Strikes + Curve)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTraceDistributionMode('call_put_split')}
                    className={`gex-trace-lens-btn ${traceDistributionMode === 'call_put_split' ? 'active' : ''}`}
                    title={traceLens === 'gex' ? 'Real Call GEX (Green) vs Put GEX (Red)' : (traceLens === 'dex' ? 'Call Delta (Sky Blue) vs Put Delta (Rose)' : 'Call Charm (Purple) vs Put Charm (Crimson)')}
                  >
                    📊 Call vs Put Split
                  </button>
                  <button
                    type="button"
                    onClick={() => setTraceDistributionMode('net_gex')}
                    className={`gex-trace-lens-btn ${traceDistributionMode === 'net_gex' ? 'active' : ''}`}
                    title={traceLens === 'gex' ? 'Real Strike Net GEX Bars' : (traceLens === 'dex' ? 'Real Strike Net Delta Pressure Bars' : 'Real Strike Net Charm Decay Bars')}
                  >
                    {traceLens === 'gex' ? '🌊 Net GEX Bars' : (traceLens === 'dex' ? '🌊 Net Delta Bars' : '🌊 Net Charm Bars')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTraceDistributionMode('abs_gex')}
                    className={`gex-trace-lens-btn ${traceDistributionMode === 'abs_gex' ? 'active' : ''}`}
                    title={traceLens === 'gex' ? 'Absolute Gamma Concentration (Key Pin Magnet)' : (traceLens === 'dex' ? 'Absolute Delta Concentration Pin' : 'Absolute Charm Decay Concentration Pin')}
                  >
                    {traceLens === 'gex' ? '🎯 Absolute Gamma (Pins)' : (traceLens === 'dex' ? '🎯 Absolute Delta (Pins)' : '🎯 Absolute Charm (Pins)')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTraceDistributionMode('curve')}
                    className={`gex-trace-lens-btn ${traceDistributionMode === 'curve' ? 'active' : ''}`}
                    title="Pure Simulated TRACE Continuous SDE Curve"
                  >
                    📈 Model Curve
                  </button>
                </div>

                <div className="gex-trace-lens-group" style={{ marginLeft: 'auto' }}>
                  <span className="gex-trace-lens-label">LENS:</span>
                  <button
                    type="button"
                    onClick={() => setTraceLens('gex')}
                    className={`gex-trace-lens-btn ${traceLens === 'gex' ? 'active' : ''}`}
                  >
                    🛡️ Gamma
                  </button>
                  <button
                    type="button"
                    onClick={() => setTraceLens('dex')}
                    className={`gex-trace-lens-btn ${traceLens === 'dex' ? 'active dex' : ''}`}
                  >
                    ⚡ Delta
                  </button>
                  <button
                    type="button"
                    onClick={() => setTraceLens('cex')}
                    className={`gex-trace-lens-btn ${traceLens === 'cex' ? 'active cex' : ''}`}
                  >
                    ⏳ Charm
                  </button>
                </div>

                <div className="gex-trace-stats-row">
                  {traceLens === 'gex' && (
                    <>
                      <div className="gex-trace-chip" style={{ borderLeft: `3px solid ${spotgammaTrace?.current_regime?.includes('POSITIVE') ? '#10b981' : '#ef4444'}` }}>
                        <span className="lbl">Regime:</span>
                        <span className="val" style={{ color: spotgammaTrace?.current_regime?.includes('POSITIVE') ? '#00E676' : '#f43f5e' }}>
                          {spotgammaTrace?.current_regime?.includes('POSITIVE') ? '🟢 POSITIVE (DAMPENING)' : '🔴 NEGATIVE (ACCELERATING)'}
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Vol Trigger (Flip):</span>
                        <span className="val" style={{ color: '#00F0FF' }}>
                          ${spotgammaTrace?.trace_zero_gamma || keyLevels.zero_gamma}
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Key Gamma Strike:</span>
                        <span className="val" style={{ color: '#f59e0b' }}>
                          ${spotgammaTrace?.key_gamma_strike || keyLevels.call_wall} ({formatDollarGex(spotgammaTrace?.key_gamma_val || 0)})
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Call Wall (Cap):</span>
                        <span className="val" style={{ color: '#00E676' }}>
                          ${keyLevels.call_wall}
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Put Wall (Floor):</span>
                        <span className="val" style={{ color: '#f43f5e' }}>
                          ${keyLevels.put_wall}
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Slope dGEX/dS:</span>
                        <span className="val" style={{ color: '#cbd5e1' }}>
                          {spotgammaTrace?.gamma_convexity_slope || 0.0}/$
                        </span>
                      </div>
                    </>
                  )}

                  {traceLens === 'dex' && (
                    <>
                      <div className="gex-trace-chip" style={{ borderLeft: `3px solid ${(spotgammaTrace?.current_spot_dex || 0) >= 0 ? '#38bdf8' : '#fb7185'}` }}>
                        <span className="lbl">Delta Bias:</span>
                        <span className="val" style={{ color: (spotgammaTrace?.current_spot_dex || 0) >= 0 ? '#38bdf8' : '#fb7185' }}>
                          {(spotgammaTrace?.current_spot_dex || 0) >= 0 ? '🟢 DEALER LONG DELTA (Supportive)' : '🔴 DEALER SHORT DELTA (Resistance)'}
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Zero Delta Level:</span>
                        <span className="val" style={{ color: '#38bdf8' }}>
                          ${spotgammaTrace?.trace_zero_delta || spot.toFixed(2)}
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Key Delta Strike:</span>
                        <span className="val" style={{ color: '#f59e0b' }}>
                          ${spotgammaTrace?.key_delta_strike || spot.toFixed(2)} ({formatDollarGex(spotgammaTrace?.key_delta_val || 0)})
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Spot Net Delta:</span>
                        <span className="val" style={{ color: (spotgammaTrace?.current_spot_dex || 0) >= 0 ? '#38bdf8' : '#fb7185' }}>
                          {formatDollarGex(spotgammaTrace?.current_spot_dex || 0)}
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Call Wall / Put Wall:</span>
                        <span className="val" style={{ color: '#cbd5e1' }}>
                          ${keyLevels.call_wall} / ${keyLevels.put_wall}
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Slope dDEX/dS:</span>
                        <span className="val" style={{ color: '#cbd5e1' }}>
                          {spotgammaTrace?.delta_slope || 0.0}/$
                        </span>
                      </div>
                    </>
                  )}

                  {traceLens === 'cex' && (
                    <>
                      <div className="gex-trace-chip" style={{ borderLeft: `3px solid ${(spotgammaTrace?.current_spot_cex || 0) >= 0 ? '#c084fc' : '#f43f5e'}` }}>
                        <span className="lbl">Charm Drift:</span>
                        <span className="val" style={{ color: (spotgammaTrace?.current_spot_cex || 0) >= 0 ? '#c084fc' : '#f43f5e' }}>
                          {(spotgammaTrace?.current_spot_cex || 0) >= 0 ? '🟣 BULLISH EXPANSION DRIFT' : '🔴 BEARISH OVERNIGHT BLEED'}
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Charm Neutral Strike:</span>
                        <span className="val" style={{ color: '#c084fc' }}>
                          ${spotgammaTrace?.trace_zero_charm || spot.toFixed(2)}
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Key Charm Strike:</span>
                        <span className="val" style={{ color: '#f59e0b' }}>
                          ${spotgammaTrace?.key_charm_strike || spot.toFixed(2)} ({formatDollarGex(spotgammaTrace?.key_charm_val || 0)}/d)
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Spot Net Charm:</span>
                        <span className="val" style={{ color: (spotgammaTrace?.current_spot_cex || 0) >= 0 ? '#c084fc' : '#f43f5e' }}>
                          {formatDollarGex(spotgammaTrace?.current_spot_cex || 0)}/day
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Call Wall / Put Wall:</span>
                        <span className="val" style={{ color: '#cbd5e1' }}>
                          ${keyLevels.call_wall} / ${keyLevels.put_wall}
                        </span>
                      </div>
                      <div className="gex-trace-chip">
                        <span className="lbl">Slope dCEX/dS:</span>
                        <span className="val" style={{ color: '#cbd5e1' }}>
                          {spotgammaTrace?.charm_slope || 0.0}/$
                        </span>
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowTraceGuide(prev => !prev)}
                    className="gex-guide-toggle-btn"
                  >
                    <Info size={12} />
                    <span>Guide: What is TRACE?</span>
                    {showTraceGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
              </div>
            )}

            {/* DELTA & CHARM MAP SUB-TOOLBAR */}
            {activeChartMode === 'delta_charm_map' && (
              <div className="gex-trace-subtoolbar">
                <div className="gex-trace-lens-group">
                  <span className="gex-trace-lens-label">HEDGE LENS:</span>
                  <button
                    type="button"
                    onClick={() => setHedgeHeatmapLens('combined')}
                    className={`gex-trace-lens-btn ${hedgeHeatmapLens === 'combined' ? 'active' : ''}`}
                  >
                    🛡️ Combined Net Pressure
                  </button>
                  <button
                    type="button"
                    onClick={() => setHedgeHeatmapLens('dex')}
                    className={`gex-trace-lens-btn ${hedgeHeatmapLens === 'dex' ? 'active dex' : ''}`}
                  >
                    ⚡ Delta Pressure (DEX)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHedgeHeatmapLens('cex')}
                    className={`gex-trace-lens-btn ${hedgeHeatmapLens === 'cex' ? 'active cex' : ''}`}
                  >
                    ⏳ Charm Decay (CEX)
                  </button>
                </div>

                <div className="gex-trace-stats-row">
                  <div className="gex-trace-chip" style={{ borderLeft: '3px solid #10b981' }}>
                    <span className="lbl">🟢 Buying Support:</span>
                    <span className="val" style={{ color: '#00E676' }}>
                      +${(data?.hedge_pressure_map?.total_buy_pressure_m || 0).toLocaleString()}M
                    </span>
                  </div>
                  <div className="gex-trace-chip" style={{ borderLeft: '3px solid #ef4444' }}>
                    <span className="lbl">🔴 Selling Resistance:</span>
                    <span className="val" style={{ color: '#f43f5e' }}>
                      -${(data?.hedge_pressure_map?.total_sell_pressure_m || 0).toLocaleString()}M
                    </span>
                  </div>
                  <div className="gex-viewmode-pill">
                    <button
                      type="button"
                      onClick={() => setHedgeHeatmapViewMode('visual')}
                      className={`viewmode-btn ${hedgeHeatmapViewMode === 'visual' ? 'active' : ''}`}
                    >
                      🗺️ 2D Heatmap
                    </button>
                    <button
                      type="button"
                      onClick={() => setHedgeHeatmapViewMode('table')}
                      className={`viewmode-btn ${hedgeHeatmapViewMode === 'table' ? 'active' : ''}`}
                    >
                      📊 Matrix
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TRACE EDUCATIONAL GUIDE BOX */}
            {activeChartMode === 'spotgamma_trace' && showTraceGuide && (
              <div className="gex-trace-guide-card">
                <div className="guide-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={14} style={{ color: '#00F0FF' }} />
                    <strong style={{ color: '#ffffff', fontSize: '13px', fontFamily: 'monospace' }}>
                      SpotGamma TRACE · Quantitative Dealer Hedging Guide
                    </strong>
                  </div>
                  <span className="guide-badge-pill">INSTITUTIONAL DERIVATIVES ENGINE</span>
                </div>
                <div className="guide-cols-3">
                  <div className="guide-col">
                    <strong style={{ color: '#00F0FF' }}>1. Simulated GEX Trace Curve</strong>
                    <p>
                      Plots dealer Net Gamma as a function of underlying price ($S \pm 8\%$).
                      Tells you what dealer hedging will do <em>before</em> price arrives: where dealers will buy dips (positive gamma green curve) vs where selling accelerates into cascades (negative gamma red curve).
                    </p>
                  </div>
                  <div className="guide-col">
                    <strong style={{ color: '#38bdf8' }}>2. Delta Pressure Map (DEX)</strong>
                    <p>
                      Net Dealer Delta ($M shares to hedge). Identifies where dealers hold long delta (buying support floors on pullbacks) vs short delta (selling pressure / resistance caps on rallies).
                    </p>
                  </div>
                  <div className="guide-col">
                    <strong style={{ color: '#c084fc' }}>3. Charm Decay Map (CEX)</strong>
                    <p>
                      Charm (dDelta/dTime) measures daily delta decay as options age. Crucial for 0DTE and afternoon trading: identifies the <strong>Charm Pin Strike</strong> where time decay forces market makers to buy or sell into the 4:00 PM close.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* DELTA & CHARM 2D VISUAL HEATMAP & ACTIONABLE SIGNALS VIEW */}
            {activeChartMode === 'delta_charm_map' && (
              <div className="gex-heatmap-container">
                {/* Visual Plotly Heatmap Canvas */}
                {hedgeHeatmapViewMode === 'visual' && (
                  <div className="gex-plotly-heatmap-wrap">
                    {/* Command Center Controls Toolbar */}
                    <div className="gex-heatmap-command-bar">
                      <div className="command-bar-left">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                          <strong style={{ fontSize: '13px', fontFamily: 'monospace', color: '#f1f5f9', letterSpacing: '0.02em' }}>
                            Price vs Time Continuous Hedge Pressure Surface
                          </strong>
                        </div>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          🟢 Green = Buyer Cushion · 🔴 Red = Seller Wall · ⭐/⚡ = Top Magnets
                        </span>
                      </div>

                      <div className="command-bar-right">
                        {/* Zoom Range Pills */}
                        <div className="gex-ctrl-pill-group">
                          <span className="gex-ctrl-label">ZOOM:</span>
                          <button
                            type="button"
                            onClick={() => setHeatmapStrikeRange(0.05)}
                            className={`gex-ctrl-btn ${heatmapStrikeRange === 0.05 ? 'active' : ''}`}
                            title="Filter strikes to ±5% of Spot (Intraday Scalps)"
                          >
                            ±5%
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeatmapStrikeRange(0.10)}
                            className={`gex-ctrl-btn ${heatmapStrikeRange === 0.10 ? 'active' : ''}`}
                            title="Filter strikes to ±10% of Spot (Standard Swing)"
                          >
                            ±10%
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeatmapStrikeRange(0.20)}
                            className={`gex-ctrl-btn ${heatmapStrikeRange === 0.20 ? 'active' : ''}`}
                            title="Filter strikes to ±20% of Spot (Macro Horizon)"
                          >
                            ±20%
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeatmapStrikeRange(1.0)}
                            className={`gex-ctrl-btn ${heatmapStrikeRange === 1.0 ? 'active' : ''}`}
                            title="Show all available option strikes"
                          >
                            All
                          </button>
                        </div>

                        {/* Smoothing Toggle */}
                        <div className="gex-ctrl-pill-group">
                          <button
                            type="button"
                            onClick={() => setHeatmapSmoothMode(prev => prev === 'smooth' ? 'discrete' : 'smooth')}
                            className={`gex-ctrl-btn ${heatmapSmoothMode === 'smooth' ? 'active' : ''}`}
                            title="Toggle between Continuous Fluid Heatmap and Discrete Strike Blocks"
                          >
                            {heatmapSmoothMode === 'smooth' ? '🌊 Fluid' : '🧱 Grid'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeatmapShowKeyLevels(prev => !prev)}
                            className={`gex-ctrl-btn ${heatmapShowKeyLevels ? 'active' : ''}`}
                            title="Toggle Spot, Zero Gamma Flip, and Wall overlay lines"
                          >
                            📏 Levels
                          </button>
                        </div>

                        {/* Snapshot PNG Export Button */}
                        <button
                          type="button"
                          onClick={handleExportHeatmap}
                          className="gex-snapshot-btn"
                          title="Download High-Resolution PNG for Trade Journal"
                        >
                          <Camera size={13} />
                          <span>Export PNG</span>
                        </button>
                      </div>
                    </div>

                    {/* Real-Time Telemetry & Pressure Split Bar */}
                    <div className="gex-heatmap-telemetry-strip">
                      <div className="telemetry-item">
                        <span className="telemetry-lbl">NET DEALER BIAS:</span>
                        <span className="telemetry-val" style={{ color: netDealerBiasM >= 0 ? '#00E676' : '#ff3366' }}>
                          {netDealerBiasM >= 0 ? '🟢 BUY-BIASED (+' : '🔴 SELL-BIASED (-$'}
                          {Math.abs(netDealerBiasM)}M{netDealerBiasM >= 0 ? ')' : ')'}
                        </span>
                      </div>

                      {/* Pressure Split Ratio Bar */}
                      <div className="telemetry-bar-wrap">
                        <div className="telemetry-bar-labels">
                          <span style={{ color: '#00E676' }}>Support {buyPct}%</span>
                          <span style={{ color: '#94a3b8' }}>PRESSURE BALANCE</span>
                          <span style={{ color: '#f43f5e' }}>Resistance {sellPct}%</span>
                        </div>
                        <div className="telemetry-progress-track">
                          <div className="progress-segment buy" style={{ width: `${buyPct}%` }} />
                          <div className="progress-segment sell" style={{ width: `${sellPct}%` }} />
                        </div>
                      </div>

                      <div className="telemetry-item">
                        <span className="telemetry-lbl">EQUILIBRIUM STRIKE:</span>
                        <span className="telemetry-val" style={{ color: '#00F0FF' }}>
                          ${equilibriumStrike ? equilibriumStrike.toFixed(2) : '---'}
                        </span>
                      </div>

                      <div className="telemetry-item">
                        <span className="telemetry-lbl">ZERO GAMMA FLIP:</span>
                        <span className="telemetry-val" style={{ color: '#cbd5e1' }}>
                          ${keyLevels.zero_gamma || '---'}
                        </span>
                      </div>

                      <div className="telemetry-item" style={{ borderLeft: '2px solid #00F0FF', paddingLeft: '8px' }}>
                        <span className="telemetry-lbl">CURRENT SPOT:</span>
                        <strong className="telemetry-val" style={{ color: '#ffffff', fontWeight: 900 }}>
                          ${spot ? Number(spot).toFixed(2) : '---'}
                        </strong>
                      </div>
                    </div>

                    <div 
                      ref={hedgePlotRef} 
                      style={{ width: '100%', minHeight: '530px', borderRadius: '10px', overflow: 'hidden' }} 
                    />
                  </div>
                )}

                {/* Table Matrix Fallback View */}
                {hedgeHeatmapViewMode === 'table' && (
                  <div className="gex-heatmap-matrix-wrapper">
                    {(() => {
                      const activeMatrix = hedgeHeatmapLens === 'dex' ? deltaMatrix : (hedgeHeatmapLens === 'cex' ? charmMatrix : deltaMatrix);
                      const expKeys = (data?.hedge_pressure_map?.expirations || expirations).slice(0, 8);
                      if (!activeMatrix || activeMatrix.length === 0) {
                        return <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Loading multi-lens Greek matrix...</div>;
                      }
                      return (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="gex-matrix-table">
                            <thead>
                              <tr>
                                <th style={{ width: '120px' }}>Strike ($)</th>
                                {expKeys.map(exp => (
                                  <th key={exp} style={{ textAlign: 'center' }}>{exp}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {activeMatrix.map((row) => {
                                const isSpot = Math.abs(row.strike - spot) / spot < 0.006;
                                const isCW = row.strike === keyLevels.call_wall;
                                const isPW = row.strike === keyLevels.put_wall;
                                const isZG = Math.abs(row.strike - keyLevels.zero_gamma) / spot < 0.006;
                                return (
                                  <tr key={row.strike} className={isSpot ? 'spot-row' : ''}>
                                    <td className="strike-cell">
                                      <strong>${row.strike}</strong>
                                      {isSpot && <span className="m-tag spot">SPOT</span>}
                                      {isCW && <span className="m-tag cw">CALL WALL</span>}
                                      {isPW && <span className="m-tag pw">PUT WALL</span>}
                                      {isZG && <span className="m-tag zg">FLIP</span>}
                                    </td>
                                    {expKeys.map(exp => {
                                      const val = row[exp] || 0;
                                      const isPos = val > 0;
                                      const isNeg = val < 0;
                                      const absVal = Math.abs(val);
                                      const bgOpacity = Math.min(0.65, Math.max(0.08, absVal / 50.0));
                                      const cellBg = isPos ? `rgba(16, 185, 129, ${bgOpacity})` : (isNeg ? `rgba(239, 68, 68, ${bgOpacity})` : 'transparent');
                                      const textColor = isPos ? '#34d399' : (isNeg ? '#fca5a5' : '#64748b');
                                      return (
                                        <td key={exp} style={{ backgroundColor: cellBg, color: textColor, textAlign: 'center', fontFamily: 'monospace', fontSize: '11px', fontWeight: 700 }}>
                                          {val === 0 ? '---' : `${val > 0 ? '+' : ''}$${val.toFixed(1)}M`}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ACTIONABLE TRADE DIRECTIVES: WHERE TO BUY VS WHERE TO SELL */}
                {data?.hedge_pressure_map && (
                  <div className="gex-actions-deck">
                    {/* Top Buy Zones */}
                    <div className="gex-action-col buy-col">
                      <div className="action-col-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="action-dot green" />
                          <strong style={{ color: '#10b981', fontSize: '12px', fontFamily: 'monospace' }}>
                            🟢 WHERE TO BUY (Dealer Buy Cushions & Long Deltas)
                          </strong>
                        </div>
                        <span className="action-pill green">SUPPORT ACCUMULATION</span>
                      </div>
                      <div className="action-cards-grid">
                        {(data.hedge_pressure_map.top_buy_zones || []).map((zone, idx) => {
                          const distPct = spot > 0 ? (((zone.strike - spot) / spot) * 100).toFixed(1) : 0;
                          const copyKey = `buy-${idx}`;
                          const isCopied = copiedZoneKey === copyKey;
                          return (
                            <div key={idx} className="action-target-card buy-card">
                              <div className="atc-top">
                                <span className="atc-strike">${zone.strike} Strike</span>
                                <span className="atc-exp">{zone.expiry}</span>
                                <span className="atc-dist" style={{ color: '#38bdf8' }}>
                                  {distPct >= 0 ? '+' : ''}{distPct}% vs Spot
                                </span>
                                <span className="atc-val green">+${zone.combined_pressure_m}M Flow</span>
                              </div>
                              <div className="atc-breakdown">
                                <span>⚡ Delta: <b>+${zone.delta_pressure_m}M</b></span>
                                <span>⏳ Charm: <b>{zone.charm_decay_m >= 0 ? '+' : ''}${zone.charm_decay_m}M/d</b></span>
                              </div>
                              <div className="atc-desc">
                                Dealer delta cushion cushions dips. 
                                <strong> Strategy: Buy pullbacks / Bull Call Spreads.</strong>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(`${ticker} Buy Floor: $${zone.strike} Exp ${zone.expiry} (+${zone.combined_pressure_m}M)`);
                                  setCopiedZoneKey(copyKey);
                                  setTimeout(() => setCopiedZoneKey(null), 2000);
                                }}
                                className="atc-copy-btn"
                              >
                                <Copy size={11} />
                                <span>{isCopied ? 'Copied!' : 'Copy Setup'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Top Sell Zones */}
                    <div className="gex-action-col sell-col">
                      <div className="action-col-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="action-dot red" />
                          <strong style={{ color: '#ef4444', fontSize: '12px', fontFamily: 'monospace' }}>
                            🔴 WHERE TO SELL (Dealer Short Deltas & Liquidation Walls)
                          </strong>
                        </div>
                        <span className="action-pill red">OVERHEAD RESISTANCE</span>
                      </div>
                      <div className="action-cards-grid">
                        {(data.hedge_pressure_map.top_sell_zones || []).map((zone, idx) => {
                          const distPct = spot > 0 ? (((zone.strike - spot) / spot) * 100).toFixed(1) : 0;
                          const copyKey = `sell-${idx}`;
                          const isCopied = copiedZoneKey === copyKey;
                          return (
                            <div key={idx} className="action-target-card sell-card">
                              <div className="atc-top">
                                <span className="atc-strike">${zone.strike} Strike</span>
                                <span className="atc-exp">{zone.expiry}</span>
                                <span className="atc-dist" style={{ color: '#fca5a5' }}>
                                  {distPct >= 0 ? '+' : ''}{distPct}% vs Spot
                                </span>
                                <span className="atc-val red">-${Math.abs(zone.combined_pressure_m)}M Flow</span>
                              </div>
                              <div className="atc-breakdown">
                                <span>⚡ Delta: <b>-${Math.abs(zone.delta_pressure_m)}M</b></span>
                                <span>⏳ Charm: <b>{zone.charm_decay_m >= 0 ? '+' : ''}${zone.charm_decay_m}M/d</b></span>
                              </div>
                              <div className="atc-desc">
                                Heavy dealer short delta forces selling into rallies. 
                                <strong> Strategy: Take profit / Trim longs / Bear Put Spreads.</strong>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(`${ticker} Sell Wall: $${zone.strike} Exp ${zone.expiry} (-$${Math.abs(zone.combined_pressure_m)}M)`);
                                  setCopiedZoneKey(copyKey);
                                  setTimeout(() => setCopiedZoneKey(null), 2000);
                                }}
                                className="atc-copy-btn"
                              >
                                <Copy size={11} />
                                <span>{isCopied ? 'Copied!' : 'Copy Setup'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Interactive Chart Container */}
            <div className="gex-chart-container" style={{ position: 'relative', display: activeChartMode === 'delta_charm_map' ? 'none' : 'block' }}>
              {/* Floating Real-Time Spot Price HUD Badge on Active Chart */}
              {spot > 0 && (
                <div className="gex-chart-spot-hud-badge">
                  <div className="spot-hud-dot" />
                  <span className="spot-hud-lbl">CURRENT SPOT:</span>
                  <strong className="spot-hud-price">${Number(spot).toFixed(2)}</strong>
                  {keyLevels.zero_gamma ? (
                    <span className="spot-hud-diff" style={{ color: spot >= keyLevels.zero_gamma ? '#00E676' : '#f43f5e' }}>
                      {spot >= keyLevels.zero_gamma ? '▲ +' : '▼ -'}{Math.abs(((spot - keyLevels.zero_gamma) / keyLevels.zero_gamma) * 100).toFixed(1)}% vs Flip (${keyLevels.zero_gamma})
                    </span>
                  ) : null}
                  {keyLevels.call_wall ? (
                    <span className="spot-hud-wall-tag" style={{ color: '#00E676' }}>
                      CW: ${keyLevels.call_wall}
                    </span>
                  ) : null}
                  {keyLevels.put_wall ? (
                    <span className="spot-hud-wall-tag" style={{ color: '#f43f5e' }}>
                      PW: ${keyLevels.put_wall}
                    </span>
                  ) : null}
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                {activeChartMode === 'spotgamma_trace' && (() => {
                  const isPureCurve = traceDistributionMode === 'curve';
                  const traceData = isPureCurve 
                    ? (spotgammaTrace?.curve || []) 
                    : ((spotgammaTrace?.strike_distribution && spotgammaTrace.strike_distribution.length > 0) 
                        ? spotgammaTrace.strike_distribution 
                        : filteredProfile);
                  const xKey = isPureCurve ? 'price' : 'strike';

                  // Dynamic Greek Lens Configuration
                  let callKey = 'call_gex';
                  let putKey = 'put_gex';
                  let netKey = 'net_gex';
                  let absKey = 'abs_gex';
                  let curveKey = 'trace_model_gex';
                  let simCurveKey = 'net_gex';
                  let callName = 'Call GEX';
                  let putName = 'Put GEX';
                  let netName = 'Net Strike GEX';
                  let absName = 'Absolute Gamma';
                  let curveName = 'TRACE Model Curve';
                  let callColor = '#10b981';
                  let putColor = '#ef4444';
                  let curveColor = '#00F0FF';
                  let keyStrike = spotgammaTrace?.key_gamma_strike || keyLevels.call_wall;
                  let keyLabel = 'Key Gamma';
                  let flipLevel = spotgammaTrace?.trace_zero_gamma || keyLevels.zero_gamma;
                  let flipLabel = 'Flip';
                  let yAxisLabel = 'Dealer Gamma Exposure ($M)';
                  let unitSuffix = '';

                  if (traceLens === 'dex') {
                    callKey = 'call_dex';
                    putKey = 'put_dex';
                    netKey = 'net_dex';
                    absKey = 'abs_dex';
                    curveKey = 'trace_model_dex';
                    simCurveKey = 'net_dex';
                    callName = 'Call Delta (Long Support)';
                    putName = 'Put Delta (Short Resistance)';
                    netName = 'Net Strike Delta Pressure';
                    absName = 'Absolute Delta Concentration';
                    curveName = 'TRACE Delta Model Curve';
                    callColor = '#38bdf8';
                    putColor = '#fb7185';
                    curveColor = '#00F0FF';
                    keyStrike = spotgammaTrace?.key_delta_strike || spot;
                    keyLabel = 'Key Delta';
                    flipLevel = spotgammaTrace?.trace_zero_delta;
                    flipLabel = 'Delta Zero';
                    yAxisLabel = 'Dealer Net Delta Exposure ($M)';
                  } else if (traceLens === 'cex') {
                    callKey = 'call_cex';
                    putKey = 'put_cex';
                    netKey = 'net_cex';
                    absKey = 'abs_cex';
                    curveKey = 'trace_model_cex';
                    simCurveKey = 'net_cex';
                    callName = 'Call Charm Flow';
                    putName = 'Put Charm Flow';
                    netName = 'Net Strike Charm Decay';
                    absName = 'Absolute Charm Concentration';
                    curveName = 'TRACE Charm Model Curve';
                    callColor = '#c084fc';
                    putColor = '#f43f5e';
                    curveColor = '#e879f9';
                    keyStrike = spotgammaTrace?.key_charm_strike || spot;
                    keyLabel = 'Key Charm';
                    flipLevel = spotgammaTrace?.trace_zero_charm;
                    flipLabel = 'Charm Neutral';
                    yAxisLabel = 'Daily Charm Decay ($M/day)';
                    unitSuffix = '/d';
                  }

                  return (
                    <ComposedChart data={traceData} margin={{ top: 25, right: 35, left: 25, bottom: 25 }}>
                      <defs>
                        <linearGradient id="traceGexAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={traceLens === 'cex' ? '#c084fc' : (traceLens === 'dex' ? '#38bdf8' : '#00E676')} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={traceLens === 'cex' ? '#f43f5e' : (traceLens === 'dex' ? '#fb7185' : '#f43f5e')} stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey={xKey}
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                        tickFormatter={(val) => {
                          const n = Number(val);
                          if (isNaN(n)) return val;
                          return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
                        }}
                        label={{ 
                          value: isPureCurve ? 'Hypothetical Price Spectrum ($)' : 'Option Strike Price ($)', 
                          position: 'insideBottom', 
                          offset: -12, 
                          fill: '#94a3b8', 
                          fontSize: 11,
                          fontFamily: 'monospace' 
                        }}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                        tickFormatter={(val) => formatDollarGex(val) + unitSuffix}
                        label={{ 
                          value: yAxisLabel, 
                          angle: -90, 
                          position: 'insideLeft', 
                          fill: '#94a3b8', 
                          fontSize: 11,
                          fontFamily: 'monospace' 
                        }}
                      />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: curveColor, borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                        formatter={(val, name, item) => {
                          const pt = item?.payload || {};
                          if (name === callName) {
                            return [`+${formatDollarGex(val)}${unitSuffix}`, `${callName} (Dealer Buy Support)`];
                          }
                          if (name === putName) {
                            return [`-${formatDollarGex(Math.abs(val))}${unitSuffix}`, `${putName} (Dealer Sell Resistance)`];
                          }
                          if (name === netName) {
                            return [`${formatDollarGex(val)}${unitSuffix}`, `${netName} (${val >= 0 ? '🟢 Positive/Support' : '🔴 Negative/Resistance'})`];
                          }
                          if (name === absName) {
                            return [`${formatDollarGex(val)}${unitSuffix}`, `${absName} Concentration Pin`];
                          }
                          if (name === curveName) {
                            return [`${formatDollarGex(val)}${unitSuffix}`, `Simulated Curve (${pt.pct_from_spot >= 0 ? '+' : ''}${pt.pct_from_spot}% vs Spot)`];
                          }
                          return [`${formatDollarGex(val)}${unitSuffix}`, name];
                        }}
                        labelFormatter={(val) => `Strike / Price: $${Number(val).toFixed(2)}`}
                      />
                      <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', color: '#cbd5e1' }} />
                      <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />

                      {spot > 0 && (
                        <ReferenceLine
                          x={isPureCurve ? spot : (closestStrikeToSpot || spot)}
                          stroke="#ffffff"
                          strokeDasharray="4 4"
                          strokeWidth={2.5}
                          label={{ position: 'top', value: `Spot $${spot.toFixed(2)}`, fill: '#ffffff', fontSize: 11, fontWeight: 800 }}
                        />
                      )}
                      {flipLevel && (
                        <ReferenceLine
                          x={flipLevel}
                          stroke={curveColor}
                          strokeDasharray="2 2"
                          strokeWidth={2}
                          label={{ position: 'bottom', value: `${flipLabel} $${flipLevel}`, fill: curveColor, fontSize: 10, fontWeight: 700 }}
                        />
                      )}
                      {keyLevels.call_wall && (
                        <ReferenceLine
                          x={keyLevels.call_wall}
                          stroke="#10b981"
                          strokeDasharray="3 3"
                          strokeWidth={1.5}
                          label={{ position: 'top', value: `CW $${keyLevels.call_wall}`, fill: '#10b981', fontSize: 10 }}
                        />
                      )}
                      {keyLevels.put_wall && (
                        <ReferenceLine
                          x={keyLevels.put_wall}
                          stroke="#ef4444"
                          strokeDasharray="3 3"
                          strokeWidth={1.5}
                          label={{ position: 'top', value: `PW $${keyLevels.put_wall}`, fill: '#ef4444', fontSize: 10 }}
                        />
                      )}
                      {keyStrike && !isPureCurve && (
                        <ReferenceLine
                          x={keyStrike}
                          stroke="#f59e0b"
                          strokeDasharray="3 3"
                          strokeWidth={1.8}
                          label={{ position: 'bottom', value: `${keyLabel} $${keyStrike}`, fill: '#f59e0b', fontSize: 10, fontWeight: 700 }}
                        />
                      )}

                      {/* 1. Combined Mode: Real Strike Distribution Bars + Smooth TRACE Line */}
                      {traceDistributionMode === 'combined' && (
                        <>
                          <Bar dataKey={callKey} name={callName} fill={callColor} opacity={0.75} radius={[3, 3, 0, 0]} />
                          <Bar dataKey={putKey} name={putName} fill={putColor} opacity={0.75} radius={[0, 0, 3, 3]} />
                          <Line
                            type="monotone"
                            dataKey={curveKey}
                            name={curveName}
                            stroke={curveColor}
                            strokeWidth={3}
                            dot={false}
                          />
                        </>
                      )}

                      {/* 2. Call vs Put Split Bars */}
                      {traceDistributionMode === 'call_put_split' && (
                        <>
                          <Bar dataKey={callKey} name={callName} fill={callColor} opacity={0.85} radius={[4, 4, 0, 0]} />
                          <Bar dataKey={putKey} name={putName} fill={putColor} opacity={0.85} radius={[0, 0, 4, 4]} />
                        </>
                      )}

                      {/* 3. Net Strike Bars */}
                      {traceDistributionMode === 'net_gex' && (
                        <>
                          <Bar dataKey={netKey} name={netName} radius={[3, 3, 3, 3]}>
                            {traceData.map((entry, idx) => {
                              const val = entry[netKey] || 0;
                              return (
                                <Cell key={`cell-${idx}`} fill={val >= 0 ? callColor : putColor} opacity={0.85} />
                              );
                            })}
                          </Bar>
                          <Line
                            type="monotone"
                            dataKey={curveKey}
                            name={curveName}
                            stroke={curveColor}
                            strokeWidth={2.5}
                            dot={false}
                          />
                        </>
                      )}

                      {/* 4. Absolute Concentration (Pins) */}
                      {traceDistributionMode === 'abs_gex' && (
                        <Bar dataKey={absKey} name={absName} radius={[4, 4, 0, 0]}>
                          {traceData.map((entry, idx) => (
                            <Cell 
                              key={`cell-${idx}`} 
                              fill={entry.strike === keyStrike ? '#f59e0b' : (traceLens === 'dex' ? '#38bdf8' : (traceLens === 'cex' ? '#c084fc' : '#38bdf8'))} 
                              opacity={entry.strike === keyStrike ? 1.0 : 0.65} 
                            />
                          ))}
                        </Bar>
                      )}

                      {/* 5. Pure SDE Continuous Simulated Curve */}
                      {traceDistributionMode === 'curve' && (
                        <Area
                          type="monotone"
                          dataKey={simCurveKey}
                          name={curveName}
                          stroke={curveColor}
                          strokeWidth={3}
                          fill="url(#traceGexAreaGrad)"
                        />
                      )}
                    </ComposedChart>
                  );
                })()}

                {activeChartMode === 'net_gex' && (
                  <ComposedChart data={filteredProfile} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="strike"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Strike Price ($)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => formatDollarGex(val)}
                      label={{ value: 'Net Dollar Gamma ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val, name) => [formatDollarGex(val), name === 'net_gex' ? 'Net Dollar GEX' : name]}
                    />
                    {spot > 0 && (
                      <ReferenceLine
                        x={closestStrikeToSpot || spot}
                        stroke="#ffffff"
                        strokeDasharray="4 4"
                        strokeWidth={2.5}
                        label={{ position: 'top', value: `Spot $${spot.toFixed(2)}`, fill: '#ffffff', fontSize: 11, fontWeight: 800 }}
                      />
                    )}
                    {keyLevels.call_wall && (
                      <ReferenceLine
                        x={keyLevels.call_wall}
                        stroke="#00E676"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{ position: 'top', value: `Call Wall $${keyLevels.call_wall}`, fill: '#00E676', fontSize: 10 }}
                      />
                    )}
                    {keyLevels.put_wall && (
                      <ReferenceLine
                        x={keyLevels.put_wall}
                        stroke="#f43f5e"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{ position: 'top', value: `Put Wall $${keyLevels.put_wall}`, fill: '#f43f5e', fontSize: 10 }}
                      />
                    )}
                    {keyLevels.zero_gamma && (
                      <ReferenceLine
                        x={keyLevels.zero_gamma}
                        stroke="#00F0FF"
                        strokeDasharray="2 2"
                        strokeWidth={1.5}
                        label={{ position: 'bottom', value: `Flip $${keyLevels.zero_gamma}`, fill: '#00F0FF', fontSize: 10 }}
                      />
                    )}
                    <Bar dataKey="net_gex" radius={[3, 3, 0, 0]}>
                      {filteredProfile.map((entry, idx) => (
                        <Cell
                          key={`cell-${entry.strike}`}
                          fill={entry.net_gex >= 0 ? '#00E676' : '#f43f5e'}
                          fillOpacity={0.85}
                        />
                      ))}
                    </Bar>
                  </ComposedChart>
                )}

                {activeChartMode === 'call_put_split' && (
                  <ComposedChart data={filteredProfile} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="strike"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Strike Price ($)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => formatDollarGex(val)}
                      label={{ value: 'Dealer Dollar Gamma ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val, name, item) => {
                        const isCall = (item?.dataKey === 'call_gex' || name === 'call_gex' || String(name).toLowerCase().includes('call'));
                        return [formatDollarGex(val), isCall ? 'Call Gamma (Long)' : 'Put Gamma (Short)'];
                      }}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', color: '#cbd5e1' }} />
                    {spot > 0 && (
                      <ReferenceLine 
                        x={closestStrikeToSpot || spot} 
                        stroke="#ffffff" 
                        strokeDasharray="4 4" 
                        strokeWidth={2.5} 
                        label={{ position: 'top', value: `Spot $${spot.toFixed(2)}`, fill: '#ffffff', fontSize: 11, fontWeight: 800 }} 
                      />
                    )}
                    <Bar dataKey="call_gex" name="Call GEX" fill="#00E676" fillOpacity={0.7} stackId="a" />
                    <Bar dataKey="put_gex" name="Put GEX" fill="#f43f5e" fillOpacity={0.7} stackId="a" />
                  </ComposedChart>
                )}

                {activeChartMode === 'vanna_vex' && (
                  <ComposedChart data={filteredProfile} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="strike"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Strike Price ($)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => formatDollarGex(val)}
                      label={{ value: 'Net Vanna Exposure ($/1% IV)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val) => [formatDollarGex(val), 'Net Dollar Vanna (VEX)']}
                    />
                    {spot > 0 && (
                      <ReferenceLine
                        x={closestStrikeToSpot || spot}
                        stroke="#ffffff"
                        strokeDasharray="4 4"
                        strokeWidth={2.5}
                        label={{ position: 'top', value: `Spot $${spot.toFixed(2)}`, fill: '#ffffff', fontSize: 11, fontWeight: 800 }}
                      />
                    )}
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                    <Bar dataKey="net_vex" radius={[3, 3, 0, 0]}>
                      {filteredProfile.map((entry) => (
                        <Cell
                          key={`vcell-${entry.strike}`}
                          fill={entry.net_vex >= 0 ? '#38bdf8' : '#fb7185'}
                          fillOpacity={0.85}
                        />
                      ))}
                    </Bar>
                  </ComposedChart>
                )}

                {activeChartMode === 'term_structure' && (
                  <ComposedChart data={termStructure} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="expiry"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Expiration Date (OpEx)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => formatDollarGex(val)}
                      label={{ value: 'Net Gamma by Expiry ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val, name, item) => {
                        const key = item?.dataKey || name;
                        let label = 'Net Term GEX';
                        if (key === 'call_gex' || String(name).toLowerCase().includes('call')) label = 'Call GEX';
                        else if (key === 'put_gex' || String(name).toLowerCase().includes('put')) label = 'Put GEX';
                        return [formatDollarGex(val), label];
                      }}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', color: '#cbd5e1' }} />
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                    <Bar dataKey="call_gex" name="Call GEX" fill="#00E676" fillOpacity={0.7} stackId="t" />
                    <Bar dataKey="put_gex" name="Put GEX" fill="#f43f5e" fillOpacity={0.7} stackId="t" />
                    <Line type="monotone" dataKey="net_gex" name="Net Term GEX" stroke="#00F0FF" strokeWidth={3} dot={{ r: 4, fill: '#00F0FF' }} />
                  </ComposedChart>
                )}

                {activeChartMode === 'oi_heatmap' && (
                  <ComposedChart data={filteredProfile} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="strike"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Strike Price ($)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                      label={{ value: oiVolSubMode === 'volume' ? 'Volume (Contracts)' : (oiVolSubMode === 'oi' ? 'Open Interest (Contracts)' : 'Contracts (Volume & OI)'), angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val, name) => [val != null ? val.toLocaleString() : 0, name]}
                    />
                    {spot > 0 && (
                      <ReferenceLine 
                        x={closestStrikeToSpot || spot} 
                        stroke="#ffffff" 
                        strokeDasharray="4 4" 
                        strokeWidth={2.5} 
                        label={{ position: 'top', value: `Spot $${spot.toFixed(2)}`, fill: '#ffffff', fontSize: 11, fontWeight: 800 }} 
                      />
                    )}

                    {/* Volume Bars */}
                    {(oiVolSubMode === 'both' || oiVolSubMode === 'volume') && (
                      <Bar dataKey="call_vol" name="Call Volume" fill="#00E676" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                    )}
                    {(oiVolSubMode === 'both' || oiVolSubMode === 'volume') && (
                      <Bar dataKey="put_vol" name="Put Volume" fill="#f43f5e" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                    )}

                    {/* Open Interest Bars */}
                    {(oiVolSubMode === 'both' || oiVolSubMode === 'oi') && (
                      <Bar dataKey="call_oi" name={totals?.is_oi_clearing ? "Call OI (Proxy)" : "Call Open Interest"} fill="#38bdf8" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                    )}
                    {(oiVolSubMode === 'both' || oiVolSubMode === 'oi') && (
                      <Bar dataKey="put_oi" name={totals?.is_oi_clearing ? "Put OI (Proxy)" : "Put Open Interest"} fill="#c084fc" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                    )}
                  </ComposedChart>
                )}

                {activeChartMode === 'cumulative' && (
                  <ComposedChart data={filteredProfile} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="strike"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Strike Price ($)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => formatDollarGex(val)}
                      label={{ value: 'Cumulative GEX ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val) => [formatDollarGex(val), 'Cumulative Dollar GEX']}
                    />
                    {spot > 0 && (
                      <ReferenceLine 
                        x={closestStrikeToSpot || spot} 
                        stroke="#ffffff" 
                        strokeDasharray="4 4" 
                        strokeWidth={2.5} 
                        label={{ position: 'top', value: `Spot $${spot.toFixed(2)}`, fill: '#ffffff', fontSize: 11, fontWeight: 800 }} 
                      />
                    )}
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                    <Area
                      type="monotone"
                      dataKey="cumulative_gex"
                      stroke="#00F0FF"
                      strokeWidth={3}
                      fill="rgba(6, 182, 212, 0.15)"
                      name="Cumulative GEX"
                    />
                  </ComposedChart>
                )}

                {activeChartMode === 'price_projection' && (
                  <ComposedChart data={projectionChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="label"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Time Horizon (Trading Days Ahead)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      domain={['auto', 'auto']}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => {
                        const n = Number(val);
                        if (isNaN(n)) return val;
                        return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
                      }}
                      label={{ value: 'Greek SDE Projected Price ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val, name) => [`$${Number(val).toFixed(2)}`, name]}
                      labelFormatter={(label) => `Horizon: ${label}`}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', color: '#cbd5e1' }} />
                    {spot > 0 && (
                      <ReferenceLine
                        y={spot}
                        stroke="#ffffff"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{ position: 'top', value: `Spot $${spot.toFixed(2)}`, fill: '#ffffff', fontSize: 10, fontWeight: 700 }}
                      />
                    )}
                    {keyLevels.call_wall && (
                      <ReferenceLine
                        y={keyLevels.call_wall}
                        stroke="#00E676"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{ position: 'top', value: `Call Wall $${keyLevels.call_wall}`, fill: '#00E676', fontSize: 10 }}
                      />
                    )}
                    {keyLevels.put_wall && (
                      <ReferenceLine
                        y={keyLevels.put_wall}
                        stroke="#f43f5e"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{ position: 'bottom', value: `Put Wall $${keyLevels.put_wall}`, fill: '#f43f5e', fontSize: 10 }}
                      />
                    )}
                    {greekProjection?.pin_equilibrium_anchor && (
                      <ReferenceLine
                        y={greekProjection.pin_equilibrium_anchor}
                        stroke="#38bdf8"
                        strokeDasharray="2 2"
                        strokeWidth={1}
                        label={{ position: 'insideTopLeft', value: `Gamma Pin Equilibrium $${greekProjection.pin_equilibrium_anchor}`, fill: '#38bdf8', fontSize: 10 }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="upper_2sigma"
                      name="+2σ Bull Expansion (95% Cl)"
                      stroke="#64748b"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="upper_1sigma"
                      name="+1σ Gamma Corridor (68% Cl)"
                      stroke="#c084fc"
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="base_target"
                      name="Expected Price (Gamma Mean-Reversion + Vanna Drift)"
                      stroke="#00F0FF"
                      strokeWidth={3}
                      dot={{ r: 3, fill: '#00F0FF' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="lower_1sigma"
                      name="-1σ Gamma Corridor (68% Cl)"
                      stroke="#c084fc"
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="lower_2sigma"
                      name="-2σ Bear Cascade (95% Cl)"
                      stroke="#64748b"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                      dot={false}
                    />
                  </ComposedChart>
                )}

                {activeChartMode === 'options_impact' && optionsImpact && (
                  <ComposedChart
                    data={optionsImpact.breakdown_chart_data || []}
                    margin={{ top: 25, right: 30, left: 20, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="category"
                      stroke="#94a3b8"
                      tick={{ fill: '#cbd5e1', fontSize: 11, fontFamily: 'monospace' }}
                      label={{ value: 'Market Volume Category', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => `${(val / 1e6).toFixed(1)}M`}
                      label={{ value: 'Volume (Millions of Shares)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val, name, item) => [
                        `${formatShares(val)} shares (${item.payload.shares_millions}M shs)`,
                        item.payload.category
                      ]}
                    />
                    <ReferenceLine
                      y={optionsImpact.adtv_shares}
                      stroke="#64748b"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ position: 'insideTopRight', value: `Stock 20D ADTV: ${formatShares(optionsImpact.adtv_shares)}`, fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                    />
                    <Bar dataKey="shares" radius={[6, 6, 0, 0]}>
                      {(optionsImpact.breakdown_chart_data || []).map((entry, index) => (
                        <Cell key={`impact-cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Microstructure Rulebook Strip for Options Impact Mode */}
            {activeChartMode === 'options_impact' && optionsImpact && (
              <div className="gex-impact-chart-footer">
                <div className="impact-footer-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={16} color={optionsImpact.impact_color} />
                    <span style={{ fontWeight: 800, color: '#ffffff', fontFamily: 'monospace', fontSize: '12px' }}>
                      QUANT TRADING PLAYBOOK FOR {optionsImpact.impact_badge}:
                    </span>
                  </div>
                  <span className="impact-footer-badge" style={{ color: optionsImpact.impact_color, borderColor: `${optionsImpact.impact_color}66` }}>
                    {optionsImpact.verdict}
                  </span>
                </div>
                <div className="impact-footer-grid">
                  <div className="impact-footer-item">
                    <span className="lbl">Options Hedging Share:</span>
                    <strong style={{ color: optionsImpact.impact_color }}>{optionsImpact.hedging_volume_ratio_pct}% of ADTV</strong>
                    <span className="sub">({formatShares(optionsImpact.total_options_hedging_shares)} / {formatShares(optionsImpact.adtv_shares)} shares/day)</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Flow Delta Hedging:</span>
                    <strong className="cyan">{formatShares(optionsImpact.flow_delta_shares)} shares</strong>
                    <span className="sub">Calls: {formatShares(optionsImpact.call_delta_flow_shares)} · Puts: {formatShares(optionsImpact.put_delta_flow_shares)}</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Gamma Dynamic Flow:</span>
                    <strong className="purple">{formatShares(optionsImpact.gamma_rehedging_shares)} shares/day</strong>
                    <span className="sub">Per expected 1D move (±${expectedMove?.move_1d || '---'})</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Net Directional Bias:</span>
                    <strong style={{ color: optionsImpact.net_directional_delta_shares >= 0 ? '#00E676' : '#f43f5e' }}>
                      {optionsImpact.net_directional_bias}
                    </strong>
                    <span className="sub">Dealers {optionsImpact.net_directional_delta_shares >= 0 ? 'buying dips to hedge' : 'selling stock into weakness'}</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Options / Stock Notional:</span>
                    <strong className="amber">{optionsImpact.options_notional_ratio}x</strong>
                    <span className="sub">${optionsImpact.options_notional_m}M Opts vs ${optionsImpact.stock_dollar_adtv_m}M Stock</span>
                  </div>
                </div>
                <div className="impact-footer-rule">
                  <span className="rule-title">Actionable Rule:</span>
                  <span className="rule-desc">{optionsImpact.trading_implication}</span>
                </div>
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* 6. DEALER PLAYBOOK & ACTIONABLE STRATEGIES TABLE                      */}
          {/* ===================================================================== */}
          <div className="gex-playbook-card">
            <div className="gex-playbook-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Crosshair size={18} color="#00F0FF" />
                <h3 style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Institutional Gamma Playbook & Trigger Rules
                </h3>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                Rule-Based Delta Hedging Exploits
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="gex-table">
                <thead>
                  <tr>
                    <th>Market Condition</th>
                    <th>Dealer Mechanics</th>
                    <th>Expected Price Behavior</th>
                    <th>Institutional Strategy</th>
                    <th>Trigger Point</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 800, color: '#38bdf8' }}>
                      Price Above Call Wall 🚀
                    </td>
                    <td>Dealers short gamma; forced to BUY shares as price ascends.</td>
                    <td>Parabolic squeeze velocity, high volume upside drift.</td>
                    <td>Long Calls / Momentum Breakout continuation tranches.</td>
                    <td style={{ color: '#00E676', fontWeight: 700 }}>Break above ${keyLevels.call_wall}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 800, color: '#00E676' }}>
                      Long Gamma Channel 🛡️
                    </td>
                    <td>Dealers long gamma; BUY dips and SELL rips against retail.</td>
                    <td>Tight consolidation range; sticky volatility suppression.</td>
                    <td>Iron Condors, Mean-Reversion Scalps, Covered Calls.</td>
                    <td style={{ color: '#00F0FF', fontWeight: 700 }}>Between ${keyLevels.put_wall} and ${keyLevels.call_wall}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 800, color: '#fbbf24' }}>
                      Approaching Zero Gamma Flip ⚖️
                    </td>
                    <td>Transition zone between stabilizing and expanding volatility.</td>
                    <td>Chop, false breakouts, and regime shifts.</td>
                    <td>Straddles / Strangle volatility expansion breakout triggers.</td>
                    <td style={{ color: '#fbbf24', fontWeight: 700 }}>Inflection at ${keyLevels.zero_gamma}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 800, color: '#f43f5e' }}>
                      Price Below Put Wall 📉
                    </td>
                    <td>Dealers short gamma; forced to aggressively SELL shares.</td>
                    <td>Cascading liquidity air pockets and accelerated downward spikes.</td>
                    <td>Long Puts, Bear Put Spreads, or Long VIX Calls.</td>
                    <td style={{ color: '#f43f5e', fontWeight: 700 }}>Break below ${keyLevels.put_wall}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 7. STRIKE × EXPIRATION MATRIX TABLE MODAL / SECTION                   */}
          {/* ===================================================================== */}
          {showMatrixModal && matrixData.length > 0 && (
            <div className="gex-matrix-card">
                <div className="gex-matrix-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Layers size={18} color="#00F0FF" />
                    <div>
                      <h3 style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' }}>
                        Strike × Expiration Gamma Matrix Heatmap
                      </h3>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        Pinpoint exact expiration concentration across active strikes
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMatrixModal(false)}
                    className="gex-matrix-close-btn"
                  >
                    Close Matrix
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="gex-matrix-table">
                    <thead>
                      <tr>
                        <th>Strike</th>
                        {expirations.slice(0, 6).map((exp) => (
                          <th key={exp}>{exp}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixData.map((row) => {
                        const isAtTheMoney = Math.abs(row.strike - spot) / spot < 0.015;
                        const isCallWall = row.strike === keyLevels.call_wall;
                        const isPutWall = row.strike === keyLevels.put_wall;

                        return (
                          <tr key={row.strike} className={isAtTheMoney ? 'atm-row' : ''}>
                            <td className="strike-cell">
                              ${row.strike.toFixed(1)}
                              {isAtTheMoney && <span className="atm-tag">ATM</span>}
                              {isCallWall && <span className="wall-tag call">CALL WALL</span>}
                              {isPutWall && <span className="wall-tag put">PUT WALL</span>}
                            </td>
                            {expirations.slice(0, 6).map((exp) => {
                              const val = row[exp] || 0;
                              const isPos = val >= 0;
                              return (
                                <td
                                  key={exp}
                                  className="matrix-val-cell"
                                  style={{
                                    color: isPos ? '#00E676' : '#f43f5e',
                                    background: isPos
                                      ? `rgba(0, 230, 118, ${Math.min(0.25, Math.abs(val) / 5e7)})`
                                      : `rgba(244, 63, 94, ${Math.min(0.25, Math.abs(val) / 5e7)})`
                                  }}
                                >
                                  {formatDollarGex(val)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </>
      )}
    </div>
  );
}
