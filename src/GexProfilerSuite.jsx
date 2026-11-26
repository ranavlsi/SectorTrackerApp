import React, { useState, useEffect, useMemo, useRef } from 'react';
import './GexProfiler.css';
import {
  Loader2, Zap, Target, TrendingUp, TrendingDown,
  Activity, Compass, Layers, AlertCircle, ArrowUpRight,
  ArrowDownRight, CheckCircle2, Sliders, Info, Eye,
  ChevronDown, ChevronUp, Crosshair, Shield, Sparkles,
  Filter, ArrowRight, ShieldCheck, Check, Maximize2,
  Bot, Cpu, Brain, Flame, Search, RefreshCw, BarChart2,
  AlertTriangle, Briefcase, ChevronRight
} from 'lucide-react';
import {
  ComposedChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ReferenceLine, ReferenceArea, ResponsiveContainer,
  Line, Area, Legend
} from 'recharts';
import SpotGammaTraceStudio from './SpotGammaTraceStudio';
import VollandFlowStudio from './VollandFlowStudio';
import DeltaCharmMapStudio from './DeltaCharmMapStudio';
import CumulativeGexStudio from './CumulativeGexStudio';

export default function GexProfilerSuite({ initialTicker = 'SPY' }) {
  const [ticker, setTicker] = useState(initialTicker || 'SPY');
  const [searchInput, setSearchInput] = useState('');
  const [selectedExpiry, setSelectedExpiry] = useState('ALL');
  const [activeChartMode, setActiveChartMode] = useState('spotgamma_trace'); // 'spotgamma_trace' | 'volland' | 'delta_charm_map' | 'net_gex' | 'call_put_split' | 'vanna_vex' | 'term_structure' | 'price_projection' | 'oi_heatmap' | 'cumulative'
  const [matrixLens, setMatrixLens] = useState('dex'); // 'dex' | 'cex' | 'gex' | 'vex'
  const [oiVolSubMode, setOiVolSubMode] = useState('both'); // 'both' | 'volume' | 'oi'
  const [thirdOrderSubMode, setThirdOrderSubMode] = useState('live_impact'); // 'live_impact' | 'speed' | 'color' | 'zomma'
  const [flowDistMetric, setFlowDistMetric] = useState('cash'); // 'cash' | 'volume'
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [plotlyReady, setPlotlyReady] = useState(false);
  const [pollIntervalSec, setPollIntervalSec] = useState(30); // 30 | 60 | 0
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const hasAutoInitRef = useRef(false);

  const quickTickers = ['SPY', 'QQQ', 'NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMD', 'SMCI'];

  const fetchGex = async (targetTicker, expiry = 'ALL', forceRefresh = false, isBackground = false) => {
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch (_) {}
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const showBlockingLoader = !isBackground && (!data || data?.ticker !== targetTicker);
    if (showBlockingLoader) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      const qs = forceRefresh ? '&refresh=1' : '';
      const res = await fetch(`/api/gex?ticker=${targetTicker}&expiry=${expiry}${qs}`, {
        signal: controller.signal,
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
        if (!hasAutoInitRef.current) {
          hasAutoInitRef.current = true;
          setPollIntervalSec(json?.data_meta?.is_market_open ? 30 : 0);
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('Failed to load GEX data:', err);
      setError(err.message || 'Failed to fetch options dealer gamma data');
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchGex(ticker, selectedExpiry, false, false);
    return () => {
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch (_) {}
      }
    };
  }, [ticker, selectedExpiry]);

  useEffect(() => {
    if (!pollIntervalSec || pollIntervalSec <= 0) return undefined;
    const id = setInterval(() => {
      fetchGex(ticker, selectedExpiry, true, true);
    }, pollIntervalSec * 1000);
    return () => clearInterval(id);
  }, [pollIntervalSec, ticker, selectedExpiry]);

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
  const liveOptionFlow = data?.live_option_flow || spotgammaTrace?.live_option_flow || null;
  const moveImpact = liveOptionFlow?.move_impact || null;
  const thirdOrder = data?.third_order_greeks || null;
  const netPressure = thirdOrder?.net_pressure || null;
  const npChannels = netPressure
    ? [
        { code: 'SPOT_GAMMA_SPEED', label: 'Spot (Gamma+Speed)', val: netPressure.spot_pressure_usd },
        { code: 'TIME_CHARM_COLOR', label: 'Time (Charm+Color)', val: netPressure.time_pressure_usd },
        { code: 'VOL_VANNA_ZOMMA', label: 'Vol (Vanna+Zomma)', val: netPressure.vol_pressure_usd },
        { code: 'LIVE_OPTION_FLOW', label: 'Live Option Flow', val: netPressure.flow_pressure_usd },
      ]
    : [];
  const thirdOrderCards = thirdOrder
    ? [
        {
          code: 'SPEED',
          title: 'SPEED (∂Γ/∂S)',
          subtitle: 'Spot Move Rate of ΔΓ',
          color: '#f59e0b',
          liveImpact: thirdOrder.live_speed_impact,
          hedgePressure: netPressure?.spot_pressure_usd,
          sharePct: thirdOrder.speed_share_pct,
          unitSensitivity: thirdOrder.total_speed_1pct,
          unitSuffix: 'per +1% Spot',
          triggerText: `Spot Move ${thirdOrder.spot_move_pct >= 0 ? '+' : ''}${Number(thirdOrder.spot_move_pct || 0).toFixed(2)}%`,
          keyLabel: 'Gamma Cliff',
          keyStrike: thirdOrder.key_strikes?.max_speed_strike,
          effectText: thirdOrder.live_speed_impact >= 0 ? 'Price move adding +Gamma stabilizer' : 'Price move draining Gamma (-accelerating)',
        },
        {
          code: 'COLOR',
          title: 'COLOR (∂Γ/∂t)',
          subtitle: 'Time Decay Pinning Drift',
          color: '#c084fc',
          liveImpact: thirdOrder.live_color_impact,
          hedgePressure: netPressure?.time_pressure_usd,
          sharePct: thirdOrder.color_share_pct,
          unitSensitivity: thirdOrder.total_color_1d,
          unitSuffix: 'per 1 Day',
          triggerText: `Session Elapsed ${Math.round(Number(thirdOrder.elapsed_day_frac || 0) * 100)}%`,
          keyLabel: 'Time Magnet',
          keyStrike: thirdOrder.key_strikes?.max_color_strike,
          effectText: thirdOrder.live_color_impact >= 0 ? 'Time decay tightening ATM Gamma pin' : 'Time decay bleeding wing Gamma support',
        },
        {
          code: 'ZOMMA',
          title: 'ZOMMA (∂Γ/∂σ)',
          subtitle: 'IV Shock Sensitivity',
          color: '#00F0FF',
          liveImpact: thirdOrder.live_zomma_impact,
          hedgePressure: netPressure?.vol_pressure_usd,
          sharePct: thirdOrder.zomma_share_pct,
          unitSensitivity: thirdOrder.total_zomma_1iv,
          unitSuffix: 'per +1v IV',
          triggerText: `Live ΔIV ${thirdOrder.d_iv_pts >= 0 ? '+' : ''}${Number(thirdOrder.d_iv_pts || 0).toFixed(2)} pts`,
          keyLabel: 'Vol Trigger',
          keyStrike: thirdOrder.key_strikes?.max_zomma_strike,
          effectText: thirdOrder.live_zomma_impact >= 0 ? 'IV shift amplifying +Gamma stability' : 'IV shift eroding Gamma stability',
        },
      ]
    : [];
  const thirdOrderChartMeta = {
    speed: {
      dataKey: 'net_speed',
      label: 'Net Dollar Speed ($ ΔGEX per +1% Spot)',
      yAxis: 'Net Speed ($ / +1% Spot)',
      posColor: '#f59e0b',
      negColor: '#f43f5e',
      inflectionLabel: 'Cliff',
      inflectionStrike: thirdOrder?.key_strikes?.max_speed_strike,
    },
    color: {
      dataKey: 'net_color',
      label: 'Net Dollar Color ($ ΔGEX per 1 Day Elapsed)',
      yAxis: 'Net Color ($ / 1d Decay)',
      posColor: '#c084fc',
      negColor: '#fb7185',
      inflectionLabel: 'Pin',
      inflectionStrike: thirdOrder?.key_strikes?.max_color_strike,
    },
    zomma: {
      dataKey: 'net_zomma',
      label: 'Net Dollar Zomma ($ ΔGEX per +1 Vol Pt IV)',
      yAxis: 'Net Zomma ($ / +1v IV)',
      posColor: '#00F0FF',
      negColor: '#fb7185',
      inflectionLabel: 'VolTrig',
      inflectionStrike: thirdOrder?.key_strikes?.max_zomma_strike,
    },
    net_pressure: {
      dataKey: 'net_pressure_usd',
      label: 'Net Dealer Buy (+) / Sell (-) Hedge Pressure ($)',
      yAxis: 'Net Dealer Buy (+) / Sell (-) ($)',
      posColor: '#00E676',
      negColor: '#f43f5e',
      inflectionLabel: null,
      inflectionStrike: null,
    },
  }[thirdOrderSubMode] || null;
  const closestThirdOrderSpotStrike = useMemo(() => {
    const prof = thirdOrder?.strike_profile;
    if (!prof?.length || !spot) return null;
    return prof.reduce((best, cur) => (Math.abs(cur.strike - spot) < Math.abs(best.strike - spot) ? cur : best), prof[0]).strike;
  }, [thirdOrder, spot]);
  const fmtVolCompact = (v) => {
    const n = Number(v || 0);
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return `${Math.round(n)}`;
  };
  const fmtFlowM = (mVal) => {
    const n = Number(mVal || 0);
    const absN = Math.abs(n);
    const sign = n >= 0 ? '+' : '-';
    if (absN >= 1000) return `${sign}$${(absN / 1000).toFixed(2)}B`;
    return `${sign}$${absN.toFixed(absN >= 100 ? 0 : 1)}M`;
  };
  const fmtCashM = (mVal) => {
    const n = Math.abs(Number(mVal || 0));
    if (n >= 1000) return `$${(n / 1000).toFixed(2)}B`;
    if (n >= 10) return `$${n.toFixed(1)}M`;
    if (n >= 0.05) return `$${n.toFixed(2)}M`;
    return `$${Math.round(n * 1000)}K`;
  };
  const volland = useMemo(() => {
    const rawSpot = Number(data?.spot_price) || 0;
    const trimNearSpot = (rows) => {
      if (!Array.isArray(rows) || rows.length <= 42 || rawSpot <= 0) return rows || [];
      const sorted = [...rows].sort((a, b) => Math.abs(a.strike - rawSpot) - Math.abs(b.strike - rawSpot));
      const nearest = sorted.slice(0, 38).sort((a, b) => a.strike - b.strike);
      return nearest;
    };

    if (data?.volland && Array.isArray(data.volland.strike_map) && data.volland.strike_map.length > 0) {
      return {
        ...data.volland,
        chart_strike_map: trimNearSpot(data.volland.strike_map),
      };
    }

    // Resilient client-side synthesis fallback if cached payload predates backend volland key
    const sourceRows = (data?.spotgamma_trace?.strike_distribution?.length ? data.spotgamma_trace.strike_distribution : data?.gex_profile) || [];
    if (!rawSpot || sourceRows.length === 0) return null;

    const nearRows = trimNearSpot(sourceRows);
    const maxG = Math.max(...nearRows.map((r) => Math.abs(r.abs_gex ?? r.net_gex ?? 0)), 1);
    const maxC = Math.max(...nearRows.map((r) => Math.abs(r.abs_cex ?? r.net_cex ?? 0)), 1);
    const maxV = Math.max(...nearRows.map((r) => Math.abs(r.abs_vex ?? r.net_vex ?? 0)), 1);

    const strike_map = nearRows.map((r) => {
      const st = Number(r.strike);
      const gp = Number(r.net_gex || 0);
      const vp = Number(r.net_vex || 0);
      const cp = Number(r.net_cex || 0);
      const gNorm = Math.abs(r.abs_gex ?? gp) / maxG;
      const cNorm = Math.abs(r.abs_cex ?? cp) / maxC;
      const vNorm = Math.abs(r.abs_vex ?? vp) / maxV;
      const distPen = Math.max(0.35, 1 - Math.min(0.65, (Math.abs(st - rawSpot) / rawSpot) * 4.5));
      const gravity_score = Number(((0.45 * gNorm + 0.3 * cNorm + 0.25 * vNorm) * distPen * 100).toFixed(1));
      return {
        strike: st,
        pct_from_spot: Number((((st - rawSpot) / rawSpot) * 100).toFixed(2)),
        gamma_pressure: gp,
        vanna_pressure: vp,
        charm_pressure: cp,
        total_volland_flow: gp + vp + cp,
        gravity_score,
        role: 'NEUTRAL',
      };
    });

    const primaryPt = strike_map.reduce((best, cur) => (cur.gravity_score > best.gravity_score ? cur : best), strike_map[0]);
    const voidPt = strike_map.reduce((best, cur) => (cur.gravity_score < best.gravity_score ? cur : best), strike_map[0]);
    const netGex = Number(data?.totals?.total_net_gex || 0);
    const netVex = Number(data?.totals?.total_net_vex || 0);
    const netCex = Number(data?.totals?.total_net_cex || 0);
    const isPos = netGex >= 0;

    // Client-side analytical Price x Volatility fallback when cached payload lacks price_vol_heatmap
    const atmIvPct = Number(data?.expected_move?.atm_iv_pct || 25.0);
    const rho = Math.max(-0.85, Math.min(0.85, Number(data?.totals?.spot_vol_corr ?? -0.55)));
    const ivShifts = [-10, -8, -6, -4, -2, -1, 0, 1, 2, 4, 6, 8, 10];
    const priceShifts = Array.from({ length: 25 }, (_, i) => Number((-8 + (i * 16) / 24).toFixed(2)));
    const prices = priceShifts.map((dp, i) => (i === 12 ? Number(rawSpot.toFixed(2)) : Number((rawSpot * (1 + dp / 100)).toFixed(2))));
    const gexM = netGex / 1e6;
    const vexM = netVex / 1e6;
    const netFlowGrid = priceShifts.map((dp, rIdx) => ivShifts.map((div, cIdx) => {
      if (rIdx === 12 && cIdx === 6) return 0;
      const gTerm = -gexM * dp;
      const vTerm = vexM * (-div);
      return Number((gTerm + vTerm).toFixed(2));
    }));
    const vannaFlowGrid = priceShifts.map((dp) => ivShifts.map((div) => (
      div === 0 ? 0 : Number((vexM * (-div) * (1 - Math.min(0.45, Math.abs(dp) * 0.04))).toFixed(2))
    )));
    const gexRegimeGrid = priceShifts.map((dp) => ivShifts.map((div) => (
      Number((gexM * (1 - div * 0.02 - Math.abs(dp) * 0.03)).toFixed(2))
    )));
    const sharesKGrid = netFlowGrid.map((row, rIdx) => row.map((mVal) => (
      prices[rIdx] > 0 ? Number(((mVal * 1e6) / prices[rIdx] / 1e3).toFixed(1)) : 0
    )));
    const ivBeta = rho * Math.max(0.75, Math.min(2.4, (atmIvPct / 16) * 1.25));
    const spotVolPath = priceShifts
      .map((dp, i) => ({ price: prices[i], price_pct: dp, raw_div: ivBeta * dp }))
      .filter((pt) => Math.abs(pt.raw_div) <= 10.2)
      .map((pt) => ({ price: pt.price, price_pct: pt.price_pct, iv_shift_pct: Number(pt.raw_div.toFixed(2)) }));

    const pickCell = (id, title, subtitle, tDp, tDiv) => {
      let ri = 12;
      let ci = 6;
      priceShifts.forEach((v, i) => { if (Math.abs(v - tDp) < Math.abs(priceShifts[ri] - tDp)) ri = i; });
      ivShifts.forEach((v, j) => { if (Math.abs(v - tDiv) < Math.abs(ivShifts[ci] - tDiv)) ci = j; });
      const nf = netFlowGrid[ri][ci];
      return {
        id,
        title,
        subtitle,
        price: prices[ri],
        price_pct: priceShifts[ri],
        iv_shift_pct: ivShifts[ci],
        sim_iv_pct: Number(Math.max(1, atmIvPct + ivShifts[ci]).toFixed(1)),
        net_flow_m: nf,
        vanna_flow_m: vannaFlowGrid[ri][ci],
        gex_m: gexRegimeGrid[ri][ci],
        shares_k: sharesKGrid[ri][ci],
        action: nf >= 0 ? 'DEALER BUY' : 'DEALER SELL',
      };
    };

    // Synthesize fallback BUY/SELL signals from the analytical grid when chain is omitted
    const synthScaleRef = Math.max(...netFlowGrid.flat().map((v) => Math.abs(v)), 0.01);
    const synthSignals = [];
    const pickBestInBox = (pLo, pHi, ivLo, ivHi, findMax) => {
      let best = null;
      priceShifts.forEach((dp, ri) => {
        if (dp < pLo || dp > pHi) return;
        ivShifts.forEach((div, ci) => {
          if (div < ivLo || div > ivHi) return;
          const v = netFlowGrid[ri][ci];
          if (!best || (findMax ? v > best.val : v < best.val)) {
            best = { ri, ci, val: v };
          }
        });
      });
      return best;
    };
    const pushSynthSig = (id, side, short_label, title, reason, cell, priority) => {
      if (!cell) return;
      synthSignals.push({
        id,
        side,
        short_label,
        title,
        reason,
        price: prices[cell.ri],
        price_pct: priceShifts[cell.ri],
        iv_shift_pct: ivShifts[cell.ci],
        sim_iv_pct: Number(Math.max(1, atmIvPct + ivShifts[cell.ci]).toFixed(1)),
        net_flow_m: netFlowGrid[cell.ri][cell.ci],
        vanna_flow_m: vannaFlowGrid[cell.ri][cell.ci],
        gex_m: gexRegimeGrid[cell.ri][cell.ci],
        shares_k: sharesKGrid[cell.ri][cell.ci],
        priority,
      });
    };
    const bCell = isPos
      ? pickBestInBox(-5.5, -1.0, -6, 4, true)
      : pickBestInBox(1.5, 5.5, -6, -1, true);
    if (bCell && bCell.val > 0.05 * synthScaleRef) {
      pushSynthSig(
        'buy_primary', 'BUY', isPos ? '▲ BUY DIP' : '▲ BUY SQUEEZE',
        isPos ? 'Buy Dip Cushion' : 'Buy Squeeze Launch',
        'Analytical dealer buying pocket.', bCell, 1,
      );
    }
    const sCell = isPos
      ? pickBestInBox(1.5, 5.5, -4, 6, false)
      : pickBestInBox(-5.5, -1.5, 1, 6, false);
    if (sCell && sCell.val < -0.05 * synthScaleRef) {
      pushSynthSig(
        'sell_primary', 'SELL', isPos ? '▼ SELL SUPPLY' : '▼ SELL CASCADE',
        isPos ? 'Sell Call-Wall Supply' : 'Sell Breakdown Cascade',
        'Analytical dealer selling supply zone.', sCell, 1,
      );
    }

    const synthHeatmap = {
      spot_price: Number(rawSpot.toFixed(2)),
      atm_iv_pct: atmIvPct,
      spot_vol_corr: rho,
      prices,
      price_shifts_pct: priceShifts,
      iv_shifts_pct: ivShifts,
      iv_labels: ivShifts.map((x) => (x === 0 ? 'LIVE (0%)' : `${x > 0 ? '+' : ''}${x}%`)),
      spot_idx: 12,
      zero_iv_idx: 6,
      net_flow_m: netFlowGrid,
      vanna_flow_m: vannaFlowGrid,
      gex_regime_m: gexRegimeGrid,
      hedge_shares_k: sharesKGrid,
      spot_vol_path: spotVolPath,
      scenarios: [
        pickCell('rally_vol_crush', 'Rally + Vol Crush', '+3% Spot · -4% IV', 3, -4),
        pickCell('rally_vol_spike', 'Rally + Vol Spike (Squeeze)', '+3% Spot · +4% IV', 3, 4),
        pickCell('dip_vol_crush', 'Dip + Vol Crush', '-3% Spot · -4% IV', -3, -4),
        pickCell('selloff_vol_spike', 'Selloff + Vol Spike (Cascade)', '-3% Spot · +4% IV', -3, 4),
      ],
      trade_signals: synthSignals,
    };

    const synthStrikeSignals = isPos
      ? [
          ...(data?.key_levels?.put_wall ? [{ side: 'BUY', strike: data.key_levels.put_wall, label: `▲ BUY FLOOR $${data.key_levels.put_wall}`, reason: 'Long Gamma Put Wall cushion' }] : []),
          ...(data?.key_levels?.call_wall ? [{ side: 'SELL', strike: data.key_levels.call_wall, label: `▼ SELL CAP $${data.key_levels.call_wall}`, reason: 'Long Gamma Call Wall overhead supply' }] : []),
        ]
      : [
          ...(data?.key_levels?.call_wall || primaryPt?.strike ? [{ side: 'BUY', strike: primaryPt?.strike || data?.key_levels?.call_wall, label: `▲ BUY MAGNET $${primaryPt?.strike || data?.key_levels?.call_wall}`, reason: 'Short Gamma squeeze pull target' }] : []),
          ...(data?.key_levels?.put_wall ? [{ side: 'SELL', strike: data.key_levels.put_wall, label: `▼ SELL BREAK $${data.key_levels.put_wall}`, reason: 'Short Gamma cascade floor' }] : []),
        ];

    return {
      paradigm_name: isPos ? 'POSITIVE GAMMA PIN' : 'NEGATIVE GAMMA ACCELERATION',
      paradigm_color: isPos ? '#00F0FF' : '#f43f5e',
      paradigm_summary: isPos
        ? 'Mean-reverting dealer book: market makers sell rallies into Call Walls and buy dips into Put Walls.'
        : 'Destabilizing dealer posture: short Gamma forces market makers to chase directional breakouts.',
      primary_magnet: primaryPt?.strike,
      pin_probability_pct: isPos ? 76 : 41,
      upper_target: data?.key_levels?.call_wall || primaryPt?.strike,
      lower_target: data?.key_levels?.put_wall || primaryPt?.strike,
      acceleration_void: voidPt?.strike,
      dealer_action_1pct_up_m: Number((-netGex).toFixed(2)),
      net_vanna_charm_drift_m: Number((netCex + 0.5 * netVex).toFixed(2)),
      strike_map,
      chart_strike_map: strike_map,
      strike_signals: synthStrikeSignals,
      price_vol_heatmap: synthHeatmap,
      intraday_flow_schedule: [
        { time: '09:30 Open', charm_flow_m: netCex * 0.12, vanna_flow_m: netVex * 0.08, net_dealer_flow_m: netCex * 0.12 + netVex * 0.08 },
        { time: '11:00 Morning', charm_flow_m: netCex * 0.28, vanna_flow_m: netVex * 0.17, net_dealer_flow_m: netCex * 0.28 + netVex * 0.17 },
        { time: '12:30 Midday', charm_flow_m: netCex * 0.45, vanna_flow_m: netVex * 0.26, net_dealer_flow_m: netCex * 0.45 + netVex * 0.26 },
        { time: '14:00 Afternoon', charm_flow_m: netCex * 0.68, vanna_flow_m: netVex * 0.36, net_dealer_flow_m: netCex * 0.68 + netVex * 0.36 },
        { time: '15:00 Power Hr', charm_flow_m: netCex * 0.85, vanna_flow_m: netVex * 0.43, net_dealer_flow_m: netCex * 0.85 + netVex * 0.43 },
        { time: '15:45 MOC Pin', charm_flow_m: netCex, vanna_flow_m: netVex * 0.5, net_dealer_flow_m: netCex + netVex * 0.5 },
      ],
    };
  }, [data]);
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
            {data?.data_meta && (
              <div className="gex-live-feed-group">
                <span
                  className={`gex-live-status-pill ${data.data_meta.is_market_open ? 'open' : 'closed'}`}
                  title={`Fetched ${data.data_meta.fetched_date} ${data.data_meta.fetched_at_et} · Session ${data.data_meta.session_date} (${data.data_meta.bars_source || '5m'}) · ${data.data_meta.all_expiries_count || expirations.length} Exps · ${data.data_meta.today_contracts_traded || 0} Traded`}
                >
                  <span className="gex-live-dot" />
                  {data.data_meta.is_market_open
                    ? `LIVE ${data.data_meta.source === 'ALPACA_LIVE' ? 'ALPACA' : data.data_meta.source} · ${data.data_meta.fetched_at_et}${data.data_meta.all_expiries_count ? ` · ${data.data_meta.all_expiries_count} Exps` : ''}`
                    : `RTH ${data.data_meta.session_date || data.data_meta.fetched_date} · ${data.data_meta.fetched_at_et}`}
                </span>
                <button
                  type="button"
                  onClick={() => fetchGex(ticker, selectedExpiry, true, true)}
                  disabled={isRefreshing}
                  className="gex-live-ctrl-btn"
                  title="Pull fresh live all-expiry option volume & intraday 5m bars in-place"
                >
                  <RefreshCw size={11} className={loading || isRefreshing ? 'animate-spin' : ''} />
                  {isRefreshing ? 'Syncing' : 'Live'}
                </button>
                <button
                  type="button"
                  onClick={() => setPollIntervalSec((v) => (v === 30 ? 60 : (v === 60 ? 0 : 30)))}
                  className={`gex-live-ctrl-btn ${pollIntervalSec > 0 ? 'active' : ''}`}
                  title="Cycle non-blocking auto-refresh cadence (30s → 60s → OFF)"
                >
                  {pollIntervalSec > 0 ? `Auto ${pollIntervalSec}s ON` : 'Auto OFF'}
                </button>
              </div>
            )}

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
                {moveImpact && (
                  <div
                    className="gex-impact-pill"
                    data-testid="hero-move-impact-pill"
                    style={{
                      borderColor: `${moveImpact.verdict_color || '#38bdf8'}66`,
                      backgroundColor: `${moveImpact.verdict_color || '#38bdf8'}16`,
                      color: moveImpact.verdict_color || '#38bdf8',
                    }}
                    title={moveImpact.explanation}
                  >
                    <Activity size={13} />
                    <span style={{ fontWeight: 800 }}>MOVE IMPACT:</span>
                    <span>{moveImpact.verdict_badge} ({moveImpact.impact_score}/100)</span>
                  </div>
                )}
                {thirdOrder && (
                  <div
                    className="gex-impact-pill"
                    data-testid="hero-greek-driver-pill"
                    style={{
                      borderColor: `${thirdOrder.dominant_color || '#f59e0b'}66`,
                      backgroundColor: `${thirdOrder.dominant_color || '#f59e0b'}16`,
                      color: thirdOrder.dominant_color || '#f59e0b',
                    }}
                    title={thirdOrder.explanation}
                  >
                    <Sparkles size={13} />
                    <span style={{ fontWeight: 800 }}>3RD-ORDER DRIVER:</span>
                    <span>{thirdOrder.dominant_label} ({thirdOrder.dominant_share_pct}%)</span>
                  </div>
                )}
                {netPressure && (
                  <div
                    className="gex-impact-pill"
                    data-testid="hero-net-pressure-pill"
                    style={{
                      borderColor: `${netPressure.color || '#94a3b8'}66`,
                      backgroundColor: `${netPressure.color || '#94a3b8'}16`,
                      color: netPressure.color || '#94a3b8',
                    }}
                    title={netPressure.summary}
                  >
                    {netPressure.side === 'SELLING' ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                    <span style={{ fontWeight: 800 }}>NET PRESSURE:</span>
                    <span>
                      {netPressure.side === 'BUYING' ? '🟢 NET BUYING' : (netPressure.side === 'SELLING' ? '🔴 NET SELLING' : '⚖️ BALANCED')} ({formatDollarGex(netPressure.total_net_pressure_usd)})
                    </span>
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
          {/* 4B. LIVE ALL-EXPIRY OPTION VOLUME & ACCELERATION / DECELERATION FLOW */}
          {/* ===================================================================== */}
          {liveOptionFlow && liveOptionFlow.total_vol > 0 && (
            <div
              className="gex-live-flow-card"
              data-testid="live-option-flow-card"
              style={{ borderColor: `${liveOptionFlow.phase_color || '#00F0FF'}44` }}
            >
              <div className="gex-live-flow-header">
                <div style={{ minWidth: 0, flex: '1 1 520px' }}>
                  <div className="gex-live-flow-title-row">
                    <Activity size={16} color={liveOptionFlow.phase_color || '#00F0FF'} />
                    <h3 className="gex-live-flow-title">
                      Live All-Expiry Call / Put Volume &amp; Flow Acceleration ({liveOptionFlow.expiries_active}/{liveOptionFlow.expiries_total} Exps)
                    </h3>
                    <span
                      className="gex-live-flow-badge"
                      data-testid="live-flow-phase-badge"
                      style={{
                        color: liveOptionFlow.phase_color || '#00F0FF',
                        borderColor: `${liveOptionFlow.phase_color || '#00F0FF'}66`,
                        background: `${liveOptionFlow.phase_color || '#00F0FF'}1A`,
                      }}
                    >
                      {liveOptionFlow.phase_label}
                    </span>
                    <span
                      className="gex-live-flow-badge"
                      style={{
                        color: liveOptionFlow.net_gamma_fuel_m < -0.5 ? '#c084fc' : '#38bdf8',
                        borderColor: liveOptionFlow.net_gamma_fuel_m < -0.5 ? 'rgba(192,132,252,0.45)' : 'rgba(56,189,248,0.45)',
                        background: liveOptionFlow.net_gamma_fuel_m < -0.5 ? 'rgba(192,132,252,0.14)' : 'rgba(56,189,248,0.12)',
                      }}
                    >
                      {liveOptionFlow.gamma_fuel_label} ({fmtFlowM(liveOptionFlow.net_gamma_fuel_m)}/1%)
                    </span>
                  </div>
                  <p className="gex-live-flow-narrative">{liveOptionFlow.narrative}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {liveOptionFlow.last_poll_delta && (
                    <span
                      className="gex-live-flow-badge"
                      style={{ color: '#00E676', borderColor: 'rgba(0,230,118,0.4)', background: 'rgba(0,230,118,0.1)' }}
                      title={`Poll window ${liveOptionFlow.last_poll_delta.from_t} → ${liveOptionFlow.last_poll_delta.to_t}`}
                    >
                      ΔPoll +{liveOptionFlow.last_poll_delta.delta_total_vol.toLocaleString()} cts ({fmtFlowM(liveOptionFlow.last_poll_delta.delta_flow_m)})
                    </span>
                  )}
                  <span
                    className="gex-live-flow-badge"
                    style={{ color: '#94a3b8', borderColor: 'rgba(148,163,184,0.28)', background: 'rgba(15,23,42,0.75)' }}
                  >
                    {liveOptionFlow.session_date} · {liveOptionFlow.resolution}
                  </span>
                </div>
              </div>

              {moveImpact && (
                <div
                  className="gex-move-impact-banner"
                  data-testid="stock-move-impact-banner"
                  style={{ borderColor: `${moveImpact.verdict_color || '#38bdf8'}44` }}
                >
                  <div className="gex-mi-left">
                    <div className="gex-mi-top-row">
                      <span className="gex-mi-eyebrow">IS TODAY&apos;S STOCK MOVE IMPACTED BY OPTIONS FLOW?</span>
                      <span
                        className="gex-mi-verdict-pill"
                        style={{
                          color: moveImpact.verdict_color || '#38bdf8',
                          borderColor: `${moveImpact.verdict_color || '#38bdf8'}66`,
                          background: `${moveImpact.verdict_color || '#38bdf8'}1A`,
                        }}
                      >
                        {moveImpact.verdict_badge}
                      </span>
                      <div className="gex-mi-score-wrap">
                        <span className="gex-mi-score-num" style={{ color: moveImpact.verdict_color || '#38bdf8' }}>
                          {moveImpact.impact_score}/100
                        </span>
                        <div className="gex-mi-score-bar">
                          <div
                            className="gex-mi-score-fill"
                            style={{
                              width: `${Math.max(4, Math.min(100, moveImpact.impact_score))}%`,
                              background: moveImpact.verdict_color || '#38bdf8',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="gex-mi-explanation">{moveImpact.explanation}</p>
                  </div>

                  <div className="gex-mi-proofs">
                    <div className="gex-mi-proof">
                      <span className="gex-mi-proof-lbl">TODAY MOVE</span>
                      <strong
                        className="gex-mi-proof-val"
                        style={{ color: moveImpact.stock_move_pct >= 0 ? '#00E676' : '#ff3366' }}
                      >
                        {moveImpact.stock_move_pct >= 0 ? '+' : ''}{moveImpact.stock_move_pct.toFixed(2)}% ({moveImpact.stock_move_pts >= 0 ? '+' : '-'}${Math.abs(moveImpact.stock_move_pts).toFixed(2)})
                      </strong>
                    </div>
                    <div className="gex-mi-proof">
                      <span className="gex-mi-proof-lbl">5M FLOW↔PRICE ρ</span>
                      <strong
                        className="gex-mi-proof-val"
                        style={{ color: moveImpact.flow_price_corr >= 0.5 ? '#00E676' : (moveImpact.flow_price_corr >= 0.25 ? '#38bdf8' : '#94a3b8') }}
                      >
                        {moveImpact.flow_price_corr >= 0 ? '+' : ''}{moveImpact.flow_price_corr.toFixed(2)} ({moveImpact.bar_agreement_pct.toFixed(0)}% match)
                      </strong>
                    </div>
                    <div className="gex-mi-proof">
                      <span className="gex-mi-proof-lbl">OPT Δ / STOCK VOL</span>
                      <strong
                        className="gex-mi-proof-val"
                        style={{ color: moveImpact.gross_opt_vs_stock_pct >= 35 ? '#00F0FF' : '#cbd5e1' }}
                      >
                        {moveImpact.gross_opt_vs_stock_pct.toFixed(1)}% (Net {moveImpact.net_hedge_vs_stock_pct.toFixed(1)}%)
                      </strong>
                    </div>
                    <div className="gex-mi-proof">
                      <span className="gex-mi-proof-lbl">FLOW VS MOVE</span>
                      <strong
                        className="gex-mi-proof-val"
                        style={{ color: moveImpact.direction_status === 'DIVERGENT' ? '#fbbf24' : (moveImpact.is_impacted ? '#00E676' : '#94a3b8') }}
                      >
                        {moveImpact.direction_status.replace('_', ' ')}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="gex-live-flow-kpis">
                <div className="gex-lf-tile">
                  <span className="gex-lf-lbl">All-Expiry Call / Put Volume</span>
                  <div className="gex-lf-val">
                    <span style={{ color: '#00E676' }}>{fmtVolCompact(liveOptionFlow.total_call_vol)} C</span>
                    <span style={{ color: '#64748b', margin: '0 6px' }}>/</span>
                    <span style={{ color: '#ff3366' }}>{fmtVolCompact(liveOptionFlow.total_put_vol)} P</span>
                  </div>
                  <div className="gex-lf-split-track">
                    <div
                      className="gex-lf-split-call"
                      style={{ width: `${Math.max(5, Math.min(95, (liveOptionFlow.total_call_vol / Math.max(1, liveOptionFlow.total_vol)) * 100))}%` }}
                    />
                  </div>
                  <span className="gex-lf-sub">
                    Total {fmtVolCompact(liveOptionFlow.total_vol)} · P/C {liveOptionFlow.put_call_vol_ratio}x · {liveOptionFlow.expiries_active} Exps
                  </span>
                </div>

                <div className="gex-lf-tile">
                  <span className="gex-lf-lbl">Net Dealer Delta Hedge Flow</span>
                  <div className="gex-lf-val" style={{ color: liveOptionFlow.net_dealer_flow_m >= 0 ? '#00E676' : '#ff3366' }}>
                    {fmtFlowM(liveOptionFlow.net_dealer_flow_m)}
                  </div>
                  <span className="gex-lf-sub">
                    Bullish Flow {liveOptionFlow.bullish_delta_pct}% · Aggressor Buy {liveOptionFlow.buy_pressure_pct}%
                  </span>
                  <span className="gex-lf-sub">
                    C Buy {fmtVolCompact(liveOptionFlow.call_buy_vol)} vs P Buy {fmtVolCompact(liveOptionFlow.put_buy_vol)}
                  </span>
                </div>

                <div className="gex-lf-tile">
                  <span className="gex-lf-lbl">Buying / Selling Velocity (5m)</span>
                  <div className="gex-lf-val" style={{ color: liveOptionFlow.velocity_m_per_5m >= 0 ? '#00E676' : '#ff3366' }}>
                    {fmtFlowM(liveOptionFlow.velocity_m_per_5m)}/5m
                  </div>
                  <span className="gex-lf-sub">
                    Vol Pace {liveOptionFlow.vol_pace_ratio}x vs Session Avg
                  </span>
                  <span className="gex-lf-sub">
                    {liveOptionFlow.velocity_m_per_5m >= 0 ? '🟢 Active Buying Pressure' : '🔴 Active Selling Pressure'}
                  </span>
                </div>

                <div className="gex-lf-tile" style={{ borderColor: `${liveOptionFlow.phase_color || '#38bdf8'}44` }}>
                  <span className="gex-lf-lbl">Flow Acceleration / Decel (Δ²)</span>
                  <div className="gex-lf-val" style={{ color: liveOptionFlow.phase_color || '#38bdf8' }}>
                    {fmtFlowM(liveOptionFlow.accel_m_per_5m2)}/5m²
                  </div>
                  <span className="gex-lf-sub" style={{ color: liveOptionFlow.phase_color || '#cbd5e1', fontWeight: 800 }}>
                    {liveOptionFlow.accel_state} ({liveOptionFlow.phase_code.replace('_', ' ')})
                  </span>
                  <span className="gex-lf-sub">
                    {liveOptionFlow.accel_state === 'ACCELERATING'
                      ? 'Momentum expanding into move'
                      : (liveOptionFlow.accel_state === 'DECELERATING' ? 'Impulse fading / mean-revert watch' : 'Steady institutional pacing')}
                  </span>
                </div>
              </div>

              {/* AI Smart-Money Flow Map (True Capital Inflow vs Outflow + 2Y+ LEAPS Horizon) */}
              {liveOptionFlow.ai_flow_intel && (
                <div
                  className="gex-ai-flow-banner"
                  data-testid="gex-ai-flow-banner"
                  style={{ borderColor: `${liveOptionFlow.ai_flow_intel.verdict_color || '#38bdf8'}44` }}
                >
                  <div className="gex-ai-flow-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="gex-ai-flow-eyebrow">🧠 AI SMART-MONEY FLOW MAP</span>
                      <span
                        className="gex-live-flow-badge"
                        data-testid="gex-ai-flow-verdict"
                        style={{
                          color: liveOptionFlow.ai_flow_intel.verdict_color || '#38bdf8',
                          borderColor: `${liveOptionFlow.ai_flow_intel.verdict_color || '#38bdf8'}66`,
                          background: `${liveOptionFlow.ai_flow_intel.verdict_color || '#38bdf8'}1A`,
                        }}
                      >
                        {liveOptionFlow.ai_flow_intel.verdict_badge}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="gex-ai-meta-pill">
                        Horizon: <b>{liveOptionFlow.ai_flow_intel.furthest_exp || '—'}</b> ({liveOptionFlow.ai_flow_intel.max_dte || 0}D)
                      </span>
                      <span className="gex-ai-meta-pill leaps">
                        LEAPS &gt;6M: <b>{fmtVolCompact(liveOptionFlow.ai_flow_intel.leaps_total_vol)}</b> · <b>{fmtCashM(liveOptionFlow.ai_flow_intel.leaps_total_prem_m)}</b> ({liveOptionFlow.ai_flow_intel.leaps_prem_share_pct}% $)
                      </span>
                    </div>
                  </div>

                  <div className="gex-ai-money-split">
                    <div className="gex-ai-money-box in" data-testid="gex-money-in-box">
                      <div className="gex-ai-money-head">
                        <span style={{ color: '#00E676' }}>▲ WHERE MONEY IS FLOWING IN</span>
                        <strong>{fmtCashM(liveOptionFlow.ai_flow_intel.total_bull_inflow_m)} Bullish Prem</strong>
                      </div>
                      <span className="gex-ai-money-sub">{liveOptionFlow.ai_flow_intel.money_in_summary}</span>
                    </div>

                    <div className="gex-ai-money-box out" data-testid="gex-money-out-box">
                      <div className="gex-ai-money-head">
                        <span style={{ color: '#ff3366' }}>▼ WHERE MONEY IS GETTING OUT / HEDGED</span>
                        <strong>{fmtCashM(liveOptionFlow.ai_flow_intel.total_bear_outflow_m)} Bear/Exit Prem</strong>
                      </div>
                      <span className="gex-ai-money-sub">{liveOptionFlow.ai_flow_intel.money_out_summary}</span>
                    </div>
                  </div>

                  <div className="gex-ai-flow-read" data-testid="gex-ai-flow-read">
                    <strong>AI Read:</strong> {liveOptionFlow.ai_flow_intel.ai_summary}
                  </div>
                </div>
              )}

              {/* Full-Width 6-Tier All-Expiry Volume & Flow Distribution (0DTE -> 2Y+ LEAPS) */}
              <div className="gex-lf-panel" data-testid="gex-expiry-dist-panel">
                <div className="gex-lf-dist-head">
                  <span className="gex-lf-panel-title">All-Expiry Volume &amp; Flow Distribution (0DTE → 2Y+ LEAPS)</span>
                  <div className="gex-lf-dist-toggles">
                    <button
                      type="button"
                      data-testid="gex-dist-mode-cash"
                      onClick={() => setFlowDistMetric('cash')}
                      className={`gex-dist-btn ${flowDistMetric === 'cash' ? 'active' : ''}`}
                    >
                      💵 Cash $ Flow
                    </button>
                    <button
                      type="button"
                      data-testid="gex-dist-mode-vol"
                      onClick={() => setFlowDistMetric('volume')}
                      className={`gex-dist-btn ${flowDistMetric === 'volume' ? 'active' : ''}`}
                    >
                      📊 Contract Vol
                    </button>
                  </div>
                </div>

                <div className="gex-lf-expiry-grid-6">
                  {(liveOptionFlow.expiry_breakdown || []).map((tier) => {
                    const isLeaps = tier.id === 'leaps_1y' || tier.id === 'leaps_2y';
                    const netPrem = Number(tier.net_prem_flow_m ?? tier.net_flow_m ?? 0);
                    const isInflow = netPrem >= 0;
                    const inflowPct = Number(tier.inflow_pct ?? 50);
                    const volOi = Number(tier.vol_oi_ratio ?? 0);
                    const totalPremM = Number(tier.total_prem_m ?? 0);
                    const premShare = Number(tier.prem_share_pct ?? 0);
                    const intentBadge = tier.intent_tag || tier.bias || 'NEUTRAL';
                    const intentClass = tier.bias === 'INFLOW' || tier.bias === 'BUYING'
                      ? 'in'
                      : (tier.bias === 'OUTFLOW' || tier.bias === 'SELLING' ? 'out' : 'flat');

                    return (
                      <div
                        key={tier.id}
                        data-testid={`gex-tier-${tier.id}`}
                        className={`gex-lf-exp-card ${isLeaps ? 'is-leaps' : ''}`}
                      >
                        <div className="gex-lf-exp-top">
                          <span className="gex-lf-exp-lbl">{tier.label}</span>
                          <span className={`gex-lf-intent-pill ${intentClass}`}>{intentBadge}</span>
                        </div>

                        <div className="gex-lf-exp-main">
                          {flowDistMetric === 'cash' ? (
                            <>
                              <span className="gex-lf-exp-vol">
                                {fmtCashM(totalPremM)}{' '}
                                <span className="gex-lf-exp-share">({premShare}% $)</span>
                              </span>
                              <span className="gex-lf-exp-sec">
                                Vol {fmtVolCompact(tier.total_vol)} ({tier.share_pct}%)
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="gex-lf-exp-vol">
                                {fmtVolCompact(tier.total_vol)}{' '}
                                <span className="gex-lf-exp-share">({tier.share_pct}% vol)</span>
                              </span>
                              <span className="gex-lf-exp-sec">
                                Cash {fmtCashM(totalPremM)} ({premShare}%)
                              </span>
                            </>
                          )}
                        </div>

                        <div className="gex-lf-flow-bar-track" title={`Inflow ${inflowPct}% vs Outflow ${(100 - inflowPct).toFixed(1)}%`}>
                          <div
                            className="gex-lf-flow-bar-in"
                            style={{ width: `${Math.max(4, Math.min(96, inflowPct))}%` }}
                          />
                        </div>

                        <div className="gex-lf-exp-foot">
                          <span style={{ color: isInflow ? '#00E676' : '#ff3366', fontWeight: 800 }}>
                            {fmtFlowM(netPrem)} {tier.money_state || (isInflow ? 'IN' : 'OUT')}
                          </span>
                          <span style={{ color: '#94a3b8' }}>
                            Vol/OI {volOi.toFixed(2)}x{tier.furthest_exp ? ` · ${tier.furthest_exp.slice(0, 7)}` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2-Column Flow Leaders + Dedicated 1Y-2Y+ LEAPS Whale Tape */}
              <div className="gex-lf-tapes-row">
                <div className="gex-lf-panel" data-testid="gex-top-flow-panel">
                  <span className="gex-lf-panel-title">Top Active All-Expiry Cash Flow Leaders</span>
                  <div className="gex-lf-strikes-wrap">
                    {(liveOptionFlow.top_flow_strikes || []).map((st) => {
                      const isIn = st.money_dir ? st.money_dir === 'IN' : st.net_flow_m >= 0;
                      const premLabel = st.prem_m != null ? fmtCashM(st.prem_m) : fmtFlowM(st.net_flow_m);
                      return (
                        <span
                          key={st.symbol || `${st.strike}_${st.expiry}_${st.type}`}
                          className="gex-lf-strike-pill"
                          style={{ borderColor: isIn ? 'rgba(0,230,118,0.3)' : 'rgba(255,51,102,0.3)' }}
                        >
                          <strong style={{ color: st.type === 'CALL' ? '#00E676' : '#ff3366' }}>
                            ${st.strike} {st.type[0]}
                          </strong>
                          <span style={{ color: '#94a3b8' }}>{st.expiry}</span>
                          <span>{fmtVolCompact(st.vol)}</span>
                          <strong style={{ color: isIn ? '#00E676' : '#ff3366' }}>
                            {isIn ? '▲' : '▼'} {premLabel}
                          </strong>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="gex-lf-panel leaps" data-testid="gex-leaps-whales-panel">
                  <span className="gex-lf-panel-title">
                    🔭 {liveOptionFlow.ai_flow_intel?.min_dte_used >= 180 ? '1Y–2Y+ LEAPS Whale Tape (≥180D)' : 'Extended-Horizon Whale Tape (>45D)'}
                  </span>
                  <div className="gex-lf-strikes-wrap">
                    {(liveOptionFlow.leaps_flow_contracts || []).length > 0 ? (
                      liveOptionFlow.leaps_flow_contracts.map((st) => {
                        const isIn = st.money_dir ? st.money_dir === 'IN' : st.net_flow_m >= 0;
                        return (
                          <span
                            key={`leaps_${st.symbol || `${st.strike}_${st.expiry}_${st.type}`}`}
                            className="gex-lf-strike-pill leaps"
                            style={{ borderColor: isIn ? 'rgba(0,240,255,0.38)' : 'rgba(255,51,102,0.35)' }}
                          >
                            <strong style={{ color: st.type === 'CALL' ? '#00F0FF' : '#fb7185' }}>
                              ${st.strike} {st.type[0]}
                            </strong>
                            <span style={{ color: '#cbd5e1' }}>{st.expiry} ({st.dte}D)</span>
                            <span>{fmtVolCompact(st.vol)}</span>
                            <strong style={{ color: isIn ? '#00E676' : '#ff3366' }}>
                              {isIn ? '▲ IN' : '▼ OUT'} {fmtCashM(st.prem_m)}
                            </strong>
                            {st.vol_oi >= 0.5 && (
                              <span className="gex-lf-voi-tag">OI {st.vol_oi}x</span>
                            )}
                          </span>
                        );
                      })
                    ) : (
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                        No active ≥180D LEAPS trades recorded yet in this session.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* 4C. 3RD-ORDER GAMMA DYNAMICS (SPEED · COLOR · ZOMMA LIVE ATTRIBUTION) */}
          {/* ===================================================================== */}
          {thirdOrder && (
            <div
              className="gex-3og-card"
              data-testid="third-order-greeks-card"
              style={{ borderColor: `${thirdOrder.dominant_color || '#f59e0b'}44` }}
            >
              <div className="gex-3og-header">
                <div className="gex-3og-title-wrap">
                  <div className="gex-3og-title-row">
                    <Sparkles size={16} color={thirdOrder.dominant_color || '#f59e0b'} />
                    <h3 className="gex-live-flow-title">
                      3rd-Order Gamma Dynamics · Speed / Color / Zomma Live Impact
                    </h3>
                    <span
                      className="gex-live-flow-badge"
                      data-testid="third-order-dominant-badge"
                      style={{
                        color: thirdOrder.dominant_color || '#f59e0b',
                        borderColor: `${thirdOrder.dominant_color || '#f59e0b'}66`,
                        background: `${thirdOrder.dominant_color || '#f59e0b'}1A`,
                      }}
                    >
                      {thirdOrder.dominant_label} · IMPACTING MOST NOW ({thirdOrder.dominant_share_pct}%)
                    </span>
                    <span
                      className="gex-live-flow-badge"
                      style={{
                        color: thirdOrder.regime_effect === 'STABILIZING' ? '#00E676' : (thirdOrder.regime_effect === 'DESTABILIZING' ? '#f43f5e' : '#94a3b8'),
                        borderColor: thirdOrder.regime_effect === 'STABILIZING' ? 'rgba(0,230,118,0.45)' : (thirdOrder.regime_effect === 'DESTABILIZING' ? 'rgba(244,63,94,0.45)' : 'rgba(148,163,184,0.35)'),
                        background: thirdOrder.regime_effect === 'STABILIZING' ? 'rgba(0,230,118,0.12)' : (thirdOrder.regime_effect === 'DESTABILIZING' ? 'rgba(244,63,94,0.12)' : 'rgba(148,163,184,0.12)'),
                      }}
                    >
                      Net ΔGEX {formatDollarGex(thirdOrder.net_gamma_shift_today)} · {thirdOrder.regime_effect}
                    </span>
                  </div>
                </div>

                <div className="gex-3og-controls">
                  <span className="gex-3og-shock-chip">
                    Spot {thirdOrder.spot_move_pct >= 0 ? '+' : ''}{Number(thirdOrder.spot_move_pct || 0).toFixed(2)}%
                  </span>
                  <span className="gex-3og-shock-chip">
                    Time {Math.round(Number(thirdOrder.elapsed_day_frac || 0) * 100)}% Day
                  </span>
                  <span className="gex-3og-shock-chip" title={`IV source: ${thirdOrder.iv_change_source}`}>
                    ΔIV {thirdOrder.d_iv_pts >= 0 ? '+' : ''}{Number(thirdOrder.d_iv_pts || 0).toFixed(2)} pts
                  </span>
                  <button
                    type="button"
                    className="gex-3og-inspect-btn"
                    onClick={() => {
                      setActiveChartMode('third_order');
                      document.querySelector('.gex-visualizer-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    Inspect Strikes →
                  </button>
                </div>
              </div>

              {netPressure && (
                <div
                  className="gex-np-banner"
                  data-testid="net-pressure-banner"
                  style={{ borderColor: `${netPressure.color || '#94a3b8'}44` }}
                >
                  <div className="gex-np-top">
                    <div className="gex-np-verdict-row">
                      <span className="gex-np-eyebrow">NET DEALER HEDGING PRESSURE RIGHT NOW:</span>
                      <span
                        className="gex-mi-verdict-pill"
                        data-testid="net-pressure-badge"
                        style={{
                          color: netPressure.color || '#94a3b8',
                          borderColor: `${netPressure.color || '#94a3b8'}66`,
                          background: `${netPressure.color || '#94a3b8'}1A`,
                        }}
                      >
                        {netPressure.badge}
                      </span>
                      <strong className="gex-np-total-val" style={{ color: netPressure.color || '#94a3b8' }}>
                        {formatDollarGex(netPressure.total_net_pressure_usd)}
                      </strong>
                    </div>

                    <div className="gex-np-tug-wrap">
                      <span className="gex-np-tug-lbl">
                        <span style={{ color: '#00E676' }}>Buy {netPressure.buy_share_pct}%</span>
                        <span style={{ color: '#64748b', margin: '0 4px' }}>vs</span>
                        <span style={{ color: '#f43f5e' }}>Sell {netPressure.sell_share_pct}%</span>
                      </span>
                      <div className="gex-np-tug-track">
                        <div
                          className="gex-np-tug-buy"
                          style={{ width: `${Math.max(4, Math.min(96, netPressure.buy_share_pct))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="gex-np-channels">
                    {npChannels.map((ch) => {
                      const isPosCh = ch.val >= 0;
                      const isDomCh = ch.code === netPressure.dominant_pressure_driver;
                      return (
                        <div
                          key={ch.code}
                          className="gex-np-ch"
                          style={isDomCh ? { borderColor: `${isPosCh ? '#00E676' : '#f43f5e'}55` } : undefined}
                        >
                          <div className="gex-np-ch-top">
                            <span className="gex-np-ch-lbl">{ch.label}</span>
                            <span
                              className="gex-np-ch-dir"
                              style={{ color: isPosCh ? '#00E676' : '#f43f5e' }}
                            >
                              {isPosCh ? 'BUYING' : 'SELLING'}
                            </span>
                          </div>
                          <strong
                            className="gex-np-ch-val"
                            style={{ color: isPosCh ? '#00E676' : '#f43f5e' }}
                          >
                            {formatDollarGex(ch.val)}
                          </strong>
                        </div>
                      );
                    })}
                  </div>

                  <p className="gex-np-summary">{netPressure.summary}</p>
                </div>
              )}

              <div className="gex-3og-share-wrap" data-testid="third-order-share-bar">
                <div className="gex-3og-share-track">
                  <div
                    className="gex-3og-share-seg"
                    style={{ width: `${Math.max(2, thirdOrder.speed_share_pct)}%`, background: '#f59e0b' }}
                    title={`Speed Share: ${thirdOrder.speed_share_pct}%`}
                  />
                  <div
                    className="gex-3og-share-seg"
                    style={{ width: `${Math.max(2, thirdOrder.color_share_pct)}%`, background: '#c084fc' }}
                    title={`Color Share: ${thirdOrder.color_share_pct}%`}
                  />
                  <div
                    className="gex-3og-share-seg"
                    style={{ width: `${Math.max(2, thirdOrder.zomma_share_pct)}%`, background: '#00F0FF' }}
                    title={`Zomma Share: ${thirdOrder.zomma_share_pct}%`}
                  />
                </div>
                <div className="gex-3og-share-legend">
                  <span style={{ color: '#f59e0b' }}>● Speed {thirdOrder.speed_share_pct}%</span>
                  <span style={{ color: '#c084fc' }}>● Color {thirdOrder.color_share_pct}%</span>
                  <span style={{ color: '#00F0FF' }}>● Zomma {thirdOrder.zomma_share_pct}%</span>
                </div>
              </div>

              <div className="gex-3og-grid">
                {thirdOrderCards.map((card) => {
                  const isWinner = card.code === thirdOrder.dominant_code;
                  return (
                    <div
                      key={card.code}
                      className={`gex-3og-tile ${isWinner ? 'is-dominant' : ''}`}
                      data-testid={`third-order-card-${card.code.toLowerCase()}`}
                      style={isWinner ? { borderColor: `${card.color}99`, boxShadow: `0 0 18px ${card.color}1F` } : undefined}
                    >
                      <div className="gex-3og-tile-top">
                        <div>
                          <div className="gex-3og-tile-title" style={{ color: card.color }}>{card.title}</div>
                          <div className="gex-3og-tile-sub">{card.subtitle}</div>
                        </div>
                        {isWinner ? (
                          <span
                            className="gex-3og-winner-badge"
                            style={{ color: '#070b14', background: card.color }}
                          >
                            #1 IMPACTING NOW
                          </span>
                        ) : (
                          <span className="gex-3og-share-pill">{card.sharePct}% share</span>
                        )}
                      </div>

                      <div className="gex-3og-metric-row">
                        <strong
                          className="gex-3og-metric-val"
                          style={{ color: card.liveImpact >= 0 ? '#00E676' : '#f43f5e' }}
                        >
                          {formatDollarGex(card.liveImpact)}
                        </strong>
                        <span className="gex-3og-metric-share">
                          {isWinner ? `${card.sharePct}% of live ΔGEX` : `vs #1 ${thirdOrder.dominant_code}`}
                        </span>
                      </div>

                      <div className="gex-3og-meta-rows">
                        <div className="gex-3og-meta-item">
                          <span>Sensitivity</span>
                          <strong style={{ color: '#e2e8f0' }}>{formatDollarGex(card.unitSensitivity)} {card.unitSuffix}</strong>
                        </div>
                        <div className="gex-3og-meta-item">
                          <span>Active Trigger</span>
                          <strong style={{ color: card.color }}>{card.triggerText}</strong>
                        </div>
                        <div className="gex-3og-meta-item">
                          <span>{card.keyLabel}</span>
                          <strong style={{ color: '#ffffff' }}>${card.keyStrike ? Number(card.keyStrike).toFixed(1) : '---'}</strong>
                        </div>
                        {card.hedgePressure !== undefined && card.hedgePressure !== null && (
                          <div className="gex-3og-meta-item">
                            <span>Hedge Flow</span>
                            <strong style={{ color: card.hedgePressure >= 0 ? '#00E676' : '#f43f5e' }}>
                              {formatDollarGex(card.hedgePressure)} · {card.hedgePressure >= 0 ? 'BUYING' : 'SELLING'}
                            </strong>
                          </div>
                        )}
                      </div>

                      <div className="gex-3og-effect">{card.effectText}</div>
                    </div>
                  );
                })}
              </div>

              <div className="gex-3og-footer">
                <p className="gex-3og-explanation">{thirdOrder.explanation}</p>
                <div className="gex-3og-footer-meta">
                  {thirdOrder.forward_1h && (
                    <span
                      className="gex-3og-fwd-pill"
                      style={{
                        color: thirdOrder.forward_1h.dominant_color || '#38bdf8',
                        borderColor: `${thirdOrder.forward_1h.dominant_color || '#38bdf8'}55`,
                      }}
                    >
                      Next-1H Watch: {thirdOrder.forward_1h.dominant_label} ({thirdOrder.forward_1h.dominant_share_pct}%)
                    </span>
                  )}
                  <span className="gex-3og-tod-note">{thirdOrder.time_of_day_note}</span>
                </div>
              </div>
            </div>
          )}

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
                    onClick={() => setActiveChartMode('volland')}
                    className={`gex-mode-btn spotgamma-trace-btn ${activeChartMode === 'volland' ? 'active' : ''}`}
                  >
                    🧲 Volland Flow
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
                    data-testid="mode-btn-third-order"
                    onClick={() => setActiveChartMode('third_order')}
                    className={`gex-mode-btn ${activeChartMode === 'third_order' ? 'active' : ''}`}
                  >
                    ⚡ Speed / Color / Zomma
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
                    data-testid="mode-btn-cumulative"
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

            {/* VANNA (VEX) SPOT-VOL CORRELATION SUB-TOOLBAR */}
            {activeChartMode === 'vanna_vex' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  padding: '8px 14px',
                  marginBottom: '8px',
                  background: 'rgba(15, 23, 42, 0.72)',
                  border: `1px solid ${(totals?.spot_vol_color || '#38bdf8')}44`,
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em' }}>
                    SPOT-VOL CORRELATION ρ(S,σ):
                  </span>
                  <span
                    style={{
                      color: totals?.spot_vol_color || '#38bdf8',
                      fontWeight: 800,
                      fontSize: '13px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: `${totals?.spot_vol_color || '#38bdf8'}18`,
                      border: `1px solid ${totals?.spot_vol_color || '#38bdf8'}55`
                    }}
                  >
                    {totals?.spot_vol_corr !== undefined
                      ? `${totals.spot_vol_corr >= 0 ? '+' : ''}${Number(totals.spot_vol_corr).toFixed(2)}`
                      : 'N/A'}
                  </span>
                  <span
                    style={{
                      color: '#0f172a',
                      background: totals?.spot_vol_color || '#38bdf8',
                      fontWeight: 800,
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    {totals?.spot_vol_badge || 'LEVERAGE (-)'}
                  </span>
                  <span style={{ color: '#e2e8f0', fontSize: '11px' }}>
                    {totals?.spot_vol_regime || 'Standard Equity Leverage (Spot ↑ → IV ↓)'}
                  </span>
                </div>
                <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                  {(totals?.spot_vol_corr ?? -0.5) >= 0.15
                    ? 'Spot ↑ + IV ↑ → Call-buying squeeze amplifies dealer delta-hedging'
                    : ((totals?.spot_vol_corr ?? -0.5) <= -0.15
                      ? `Spot ↑ + IV ↓ → Vol crush triggers ${(totals?.total_net_vex ?? 0) >= 0 ? 'dealer share buybacks (+VEX fuel)' : 'dealer share selling (-VEX drag)'}`
                      : 'Decoupled Spot-Vol → Watch post-event IV crush for Vanna hedge flows')}
                </span>
              </div>
            )}

            {/* 3RD-ORDER GREEKS (SPEED / COLOR / ZOMMA) SUB-TOOLBAR */}
            {activeChartMode === 'third_order' && thirdOrder && (
              <div className="gex-3og-subbar" data-testid="third-order-subbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace' }}>
                    3RD-ORDER LENS:
                  </span>
                  {[
                    { id: 'live_impact', label: 'Live ΔGEX Impact ($)', accent: thirdOrder.dominant_color || '#38bdf8' },
                    { id: 'net_pressure', label: 'Net Buy/Sell ($)', accent: netPressure?.color || '#00E676' },
                    { id: 'speed', label: 'Speed (∂Γ/∂S)', accent: '#f59e0b' },
                    { id: 'color', label: 'Color (∂Γ/∂t)', accent: '#c084fc' },
                    { id: 'zomma', label: 'Zomma (∂Γ/∂σ)', accent: '#00F0FF' },
                  ].map((tab) => {
                    const isActive = thirdOrderSubMode === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        data-testid={`third-order-sub-${tab.id}`}
                        onClick={() => setThirdOrderSubMode(tab.id)}
                        style={{
                          background: isActive ? tab.accent : 'rgba(255,255,255,0.06)',
                          color: isActive ? '#070b14' : '#cbd5e1',
                          border: `1px solid ${isActive ? tab.accent : 'rgba(255,255,255,0.12)'}`,
                          borderRadius: '5px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontWeight: 800,
                          fontSize: '11px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
                <span
                  className="gex-live-flow-badge"
                  style={{
                    color: thirdOrder.dominant_color || '#f59e0b',
                    borderColor: `${thirdOrder.dominant_color || '#f59e0b'}66`,
                    background: `${thirdOrder.dominant_color || '#f59e0b'}1A`,
                  }}
                >
                  {thirdOrder.dominant_label} · {thirdOrder.dominant_share_pct}%
                </span>
              </div>
            )}

            {/* SPOTGAMMA TRACE STUDIO v3.0 */}
            {activeChartMode === 'spotgamma_trace' && (
              <SpotGammaTraceStudio
                ticker={ticker}
                spot={spot}
                spotgammaTrace={spotgammaTrace}
                keyLevels={keyLevels}
                totals={totals}
                expectedMove={expectedMove}
                plotlyReady={plotlyReady}
                formatDollarGex={formatDollarGex}
                liveOptionFlow={liveOptionFlow}
                dataMeta={data?.data_meta}
              />
            )}

            {/* VOLLAND FLOW STUDIO v3.0 */}
            {activeChartMode === 'volland' && (
              <VollandFlowStudio
                ticker={ticker}
                spot={spot}
                volland={volland}
                keyLevels={keyLevels}
                totals={totals}
                expectedMove={expectedMove}
                plotlyReady={plotlyReady}
              />
            )}

            {/* DELTA & CHARM MAP STUDIO v3.0 */}
            {activeChartMode === 'delta_charm_map' && (
              <DeltaCharmMapStudio
                ticker={ticker}
                spot={spot}
                hedgeMap={data?.hedge_pressure_map}
                keyLevels={keyLevels}
                expectedMove={expectedMove}
                plotlyReady={plotlyReady}
              />
            )}

            {/* CUMULATIVE GEX STUDIO v3.0 */}
            {activeChartMode === 'cumulative' && (
              <CumulativeGexStudio
                ticker={ticker}
                spot={spot}
                rawProfile={rawProfile}
                spotgammaTrace={spotgammaTrace}
                keyLevels={keyLevels}
                totals={totals}
                expectedMove={expectedMove}
                selectedExpiry={selectedExpiry}
                plotlyReady={plotlyReady}
                formatDollarGex={formatDollarGex}
              />
            )}

            {/* Interactive Chart Container */}
            <div className="gex-chart-container" style={{ position: 'relative', display: (activeChartMode === 'spotgamma_trace' || activeChartMode === 'volland' || activeChartMode === 'delta_charm_map' || activeChartMode === 'cumulative') ? 'none' : 'block' }}>
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
                      formatter={(val) => [
                        `${formatDollarGex(val)} (${val >= 0 ? 'Dealers BUY on IV drop' : 'Dealers SELL on IV drop'})`,
                        'Net Dollar Vanna (VEX)'
                      ]}
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

                {activeChartMode === 'third_order' && thirdOrder && (
                  <ComposedChart data={thirdOrder.strike_profile || []} margin={{ top: 44, right: 30, left: 20, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="strike"
                      height={46}
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Strike Price ($)', position: 'insideBottom', offset: 2, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => formatDollarGex(val)}
                      label={{
                        value: thirdOrderChartMeta ? thirdOrderChartMeta.yAxis : 'Live Session ΔGEX Impact ($)',
                        angle: -90,
                        position: 'insideLeft',
                        fill: '#94a3b8',
                        fontSize: 11,
                      }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val, name) => [formatDollarGex(val), name]}
                    />
                    <Legend verticalAlign="bottom" height={24} wrapperStyle={{ paddingTop: '6px', fontFamily: 'monospace', fontSize: '11px', color: '#cbd5e1' }} />
                    {spot > 0 && closestThirdOrderSpotStrike && (
                      <ReferenceLine
                        x={closestThirdOrderSpotStrike}
                        stroke="#ffffff"
                        strokeDasharray="4 4"
                        strokeWidth={2.5}
                        label={{ position: 'top', value: `Spot $${spot.toFixed(2)}`, fill: '#ffffff', fontSize: 11, fontWeight: 800 }}
                      />
                    )}
                    {thirdOrderChartMeta?.inflectionStrike && (
                      <ReferenceLine
                        x={thirdOrderChartMeta.inflectionStrike}
                        stroke={thirdOrderChartMeta.posColor}
                        strokeDasharray="3 3"
                        strokeWidth={1.8}
                        label={{
                          position: 'top',
                          value: `${thirdOrderChartMeta.inflectionLabel} $${thirdOrderChartMeta.inflectionStrike}`,
                          fill: thirdOrderChartMeta.posColor,
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      />
                    )}
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                    {thirdOrderSubMode === 'live_impact' ? (
                      <>
                        <Bar dataKey="live_speed_impact" name="Speed ΔGEX (Spot)" fill="#f59e0b" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="live_color_impact" name="Color ΔGEX (Time)" fill="#c084fc" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="live_zomma_impact" name="Zomma ΔGEX (IV)" fill="#00F0FF" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                      </>
                    ) : (
                      <Bar dataKey={thirdOrderChartMeta.dataKey} name={thirdOrderChartMeta.label} radius={[3, 3, 0, 0]}>
                        {(thirdOrder.strike_profile || []).map((entry) => {
                          const v = Number(entry[thirdOrderChartMeta.dataKey] || 0);
                          return (
                            <Cell
                              key={`tog-${thirdOrderSubMode}-${entry.strike}`}
                              fill={v >= 0 ? thirdOrderChartMeta.posColor : thirdOrderChartMeta.negColor}
                              fillOpacity={0.85}
                            />
                          );
                        })}
                      </Bar>
                    )}
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

            {/* Microstructure Rulebook Strip for Net Vanna (VEX) Mode */}
            {activeChartMode === 'vanna_vex' && (
              <div className="gex-impact-chart-footer">
                <div className="impact-footer-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} color="#38bdf8" />
                    <span style={{ fontWeight: 800, color: '#ffffff', fontFamily: 'monospace', fontSize: '12px' }}>
                      QUANT DEALER VANNA (VEX) SENSITIVITY PLAYBOOK · {ticker}:
                    </span>
                  </div>
                  <span
                    className="impact-footer-badge"
                    style={{
                      color: (totals?.total_net_vex || 0) >= 0 ? '#38bdf8' : '#fb7185',
                      borderColor: (totals?.total_net_vex || 0) >= 0 ? '#38bdf866' : '#fb718566'
                    }}
                  >
                    {(totals?.total_net_vex || 0) >= 0 ? 'VANNA FUEL BULLISH 🚀' : 'VANNA DRAG BEARISH ⚠️'}
                  </span>
                </div>
                <div className="impact-footer-grid">
                  <div className="impact-footer-item">
                    <span className="lbl">Total Net VEX:</span>
                    <strong style={{ color: (totals?.total_net_vex || 0) >= 0 ? '#38bdf8' : '#fb7185' }}>
                      {formatDollarGex(totals?.total_net_vex || 0)} / 1% IV
                    </strong>
                    <span className="sub">Market maker delta shift per 1% change in IV</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">IV Crush (Post-Event / OpEx):</span>
                    <strong style={{ color: (totals?.total_net_vex || 0) >= 0 ? '#00E676' : '#f43f5e' }}>
                      {(totals?.total_net_vex || 0) >= 0 ? 'Dealers BUY Stock (+Fuel)' : 'Dealers SELL Stock (-Drag)'}
                    </strong>
                    <span className="sub">Post-earnings / FOMC vol drop forces dealer {(totals?.total_net_vex || 0) >= 0 ? 'buying' : 'selling'}</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Vol Spike (Selloff / Fear):</span>
                    <strong style={{ color: (totals?.total_net_vex || 0) >= 0 ? '#f43f5e' : '#00E676' }}>
                      {(totals?.total_net_vex || 0) >= 0 ? 'Dealers SELL Stock (-Amplifies)' : 'Dealers BUY Stock (+Buffers)'}
                    </strong>
                    <span className="sub">Rising fear index flips hedging into {(totals?.total_net_vex || 0) >= 0 ? 'mechanical selling' : 'dip cushioning'}</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Strike Bar Anatomy:</span>
                    <strong className="cyan">🟦 Blue &gt; 0 · 🟥 Red &lt; 0</strong>
                    <span className="sub">Blue strikes: dealers buy as IV falls; Red strikes: dealers sell</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Tactical Implication:</span>
                    <strong className="purple">
                      {(totals?.total_net_vex || 0) >= 0 ? 'Catalyst Melt-Up Potential' : 'Vol Compression Headwind'}
                    </strong>
                    <span className="sub">{(totals?.total_net_vex || 0) >= 0 ? 'IV crush ignites upward squeeze' : 'Fading IV creates downward resistance'}</span>
                  </div>
                </div>
                <div className="impact-footer-rule">
                  <span className="rule-title">VEX Mechanical Rule:</span>
                  <span className="rule-desc">
                    {(totals?.total_net_vex || 0) >= 0
                      ? `Dealers hold positive Vanna (${formatDollarGex(totals?.total_net_vex || 0)}/1% IV). When Implied Volatility drops (such as after earnings, economic releases, or OpEx), dealers must aggressively BUY shares of ${ticker} to keep their portfolios delta-neutral. This creates the classic "Vanna Melt-Up" even on neutral news. Watch for acceleration toward the tall blue strikes above spot.`
                      : `Dealers hold negative Vanna (${formatDollarGex(totals?.total_net_vex || 0)}/1% IV). Volatility contraction forces dealers to mechanically SELL shares of ${ticker} to adjust delta. Even if news is favorable, rallies will face a stiff "Vanna Drag" unless aggressive cash equity buyers overwhelm market maker hedging.`
                    }
                  </span>
                </div>
              </div>
            )}

            {/* Microstructure Rulebook Strip for 3rd-Order Greeks (Speed / Color / Zomma) */}
            {activeChartMode === 'third_order' && thirdOrder && (
              <div className="gex-impact-chart-footer">
                <div className="impact-footer-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} color={thirdOrder.dominant_color || '#f59e0b'} />
                    <span style={{ fontWeight: 800, color: '#ffffff', fontFamily: 'monospace', fontSize: '12px' }}>
                      3RD-ORDER GAMMA CONVEXITY PLAYBOOK · {ticker}:
                    </span>
                  </div>
                  <span
                    className="impact-footer-badge"
                    style={{
                      color: thirdOrder.dominant_color || '#f59e0b',
                      borderColor: `${thirdOrder.dominant_color || '#f59e0b'}66`,
                    }}
                  >
                    {thirdOrder.dominant_label} ({thirdOrder.dominant_share_pct}%)
                  </span>
                </div>
                <div className="impact-footer-grid">
                  <div className="impact-footer-item">
                    <span className="lbl">Speed Impact (∂Γ/∂S):</span>
                    <strong style={{ color: '#f59e0b' }}>{formatDollarGex(thirdOrder.live_speed_impact)} ({thirdOrder.speed_share_pct}%)</strong>
                    <span className="sub">Sensitivity {formatDollarGex(thirdOrder.total_speed_1pct)} / +1% Spot · Cliff ${thirdOrder.key_strikes?.max_speed_strike}</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Color Impact (∂Γ/∂t):</span>
                    <strong style={{ color: '#c084fc' }}>{formatDollarGex(thirdOrder.live_color_impact)} ({thirdOrder.color_share_pct}%)</strong>
                    <span className="sub">Sensitivity {formatDollarGex(thirdOrder.total_color_1d)} / 1d · Pin ${thirdOrder.key_strikes?.max_color_strike}</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Zomma Impact (∂Γ/∂σ):</span>
                    <strong style={{ color: '#00F0FF' }}>{formatDollarGex(thirdOrder.live_zomma_impact)} ({thirdOrder.zomma_share_pct}%)</strong>
                    <span className="sub">Sensitivity {formatDollarGex(thirdOrder.total_zomma_1iv)} / +1v IV · Trig ${thirdOrder.key_strikes?.max_zomma_strike}</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Net Session ΔGEX:</span>
                    <strong style={{ color: thirdOrder.net_gamma_shift_today >= 0 ? '#00E676' : '#f43f5e' }}>
                      {formatDollarGex(thirdOrder.net_gamma_shift_today)}
                    </strong>
                    <span className="sub">{thirdOrder.regime_effect} dealer book today</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Next-1H Dominance:</span>
                    <strong style={{ color: thirdOrder.forward_1h?.dominant_color || '#38bdf8' }}>
                      {thirdOrder.forward_1h?.dominant_code} ({thirdOrder.forward_1h?.dominant_share_pct}%)
                    </strong>
                    <span className="sub">Rolling 60m shock risk leader</span>
                  </div>
                </div>
                <div className="impact-footer-rule">
                  <span className="rule-title">Live 3rd-Order Attribution:</span>
                  <span className="rule-desc">{thirdOrder.explanation}</span>
                </div>
              </div>
            )}

            {/* Microstructure Rulebook Strip for Net GEX Mode */}
            {activeChartMode === 'net_gex' && (() => {
              const netGexVal = totals?.total_net_gex || 0;
              const flipVal = keyLevels?.zero_gamma;
              const isStrictPos = netGexVal >= 0 && (!flipVal || spot >= flipVal);
              const isStrictNeg = netGexVal < 0 && (!flipVal || spot < flipVal);
              const badgeColor = isStrictPos ? '#00E676' : (isStrictNeg ? '#f43f5e' : '#fbbf24');
              const badgeText = isStrictPos
                ? '🟢 POSITIVE GAMMA ZONE (STABILIZING)'
                : (isStrictNeg ? '🌪️ NEGATIVE GAMMA ZONE (ACCELERATING)' : '⚖️ TRANSITIONAL GAMMA BOUNDARY');
              return (
              <div className="gex-impact-chart-footer">
                <div className="impact-footer-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={16} color={badgeColor} />
                    <span style={{ fontWeight: 800, color: '#ffffff', fontFamily: 'monospace', fontSize: '12px' }}>
                      DEALER NET GEX PROFILE & LIVE REGIME DIAGNOSTIC · {ticker}:
                    </span>
                  </div>
                  <span
                    className="impact-footer-badge"
                    style={{
                      color: badgeColor,
                      borderColor: `${badgeColor}66`
                    }}
                  >
                    {badgeText}
                  </span>
                </div>
                <div className="impact-footer-grid">
                  <div className="impact-footer-item">
                    <span className="lbl">Zero Gamma Flip:</span>
                    <strong style={{ color: spot >= (flipVal || spot) ? '#00E676' : '#fbbf24' }}>
                      ${flipVal || '---'}
                    </strong>
                    <span className="sub">
                      {flipVal ? (
                        spot >= flipVal
                          ? `▲ +${(((spot - flipVal) / flipVal) * 100).toFixed(1)}% above flip (Safe)`
                          : `▼ -${Math.abs(((spot - flipVal) / flipVal) * 100).toFixed(1)}% below flip (Turbulent)`
                      ) : 'Vol inflection line'}
                    </span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Total Net Gamma:</span>
                    <strong style={{ color: netGexVal >= 0 ? '#00E676' : '#f43f5e' }}>
                      {formatDollarGex(netGexVal)} / 1%
                    </strong>
                    <span className="sub">{netGexVal >= 0 ? 'Long Gamma (Mean-Reverting)' : 'Short Gamma (Expanding Volatility)'}</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Dealer Market Behavior:</span>
                    <strong className="cyan">
                      {netGexVal >= 0 ? 'COUNTER-TREND (Absorber)' : 'PRO-TREND (Accelerator)'}
                    </strong>
                    <span className="sub">{netGexVal >= 0 ? 'Dealers buy dips & sell rips' : 'Dealers sell down-moves & buy breakouts'}</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Structural Bracket:</span>
                    <strong className="purple">
                      ${keyLevels?.put_wall || '---'} ── ${keyLevels?.call_wall || '---'}
                    </strong>
                    <span className="sub">Put Wall Floor vs Call Wall Overhead Ceiling</span>
                  </div>
                  <div className="impact-footer-item">
                    <span className="lbl">Strike GEX Anatomy:</span>
                    <strong className="amber">Pins & Air Pockets</strong>
                    <span className="sub">Green bars = dip buying; Red bars = selling</span>
                  </div>
                </div>
                <div className="impact-footer-rule">
                  <span className="rule-title">What Current GEX is Suggesting Right Now:</span>
                  <span className="rule-desc">
                    {isStrictPos ? (
                      `${ticker} is trading at $${spot.toFixed(2)}, comfortably ABOVE the Zero Gamma Flip ($${flipVal}). Aggregate dealer gamma is positive (${formatDollarGex(netGexVal)}). This indicates market makers act as volatility absorbers — dampening swings by buying dips toward the Put Wall ($${keyLevels?.put_wall}) and capping upside near the Call Wall ($${keyLevels?.call_wall}).`
                    ) : isStrictNeg ? (
                      `${ticker} is trading at $${spot.toFixed(2)}, BELOW the Zero Gamma Flip ($${flipVal}) with negative aggregate dealer gamma (${formatDollarGex(netGexVal)}). In this regime, dealers are VOLATILITY ACCELERATORS — selling weakness and buying breakouts, creating wider swings inside the $${keyLevels?.put_wall}–$${keyLevels?.call_wall} corridor.`
                    ) : (
                      `${ticker} is trading at $${spot.toFixed(2)} right near the Zero Gamma Flip ($${flipVal}), while aggregate dealer gamma is ${formatDollarGex(netGexVal)}. Expect transitional boundary behavior between Put Wall ($${keyLevels?.put_wall}) support and Call Wall ($${keyLevels?.call_wall}) resistance.`
                    )}
                  </span>
                </div>
              </div>
              );
            })()}
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
