import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Camera, Info, ChevronDown, ChevronUp, RotateCcw,
  Clock, Layers, Compass, BarChart2
} from 'lucide-react';

const LENS_CFG = {
  net_flow: {
    label: 'Net Dealer Flow',
    short: 'Net',
    posColor: '#00E676',
    negColor: '#ff3366',
    posMeaning: 'DEALER BUY PRESSURE (Dip Support / Short-Cover Tailwind)',
    negMeaning: 'DEALER SELL PRESSURE (Supply Ceiling / Cascade Drag)',
  },
  vanna: {
    label: 'Pure Vanna Flow',
    short: 'Vanna',
    posColor: '#22d3ee',
    negColor: '#fb7185',
    posMeaning: 'POSITIVE VANNA FLOW (IV Compression Forces Dealer Buying)',
    negMeaning: 'NEGATIVE VANNA FLOW (IV Expansion Forces Dealer Selling)',
  },
  charm: {
    label: 'Charm Decay Flow',
    short: 'Charm',
    posColor: '#c084fc',
    negColor: '#f43f5e',
    posMeaning: 'POSITIVE CHARM DRIFT (Time Decay Creates Dealer Bid Into Close)',
    negMeaning: 'NEGATIVE CHARM DRIFT (Time Decay Forces Dealer Selling Into Close)',
  },
  gex: {
    label: 'Gamma Regime (GEX)',
    short: 'Gamma',
    posColor: '#00E676',
    negColor: '#ff3366',
    posMeaning: 'POSITIVE GAMMA (Dealers Dampen Vol · Mean Reversion)',
    negMeaning: 'NEGATIVE GAMMA (Dealers Chase Moves · Trend Expansion)',
  },
};

const TIME_HORIZONS = [
  { id: 0, short: 'Live', full: 'Live Book' },
  { id: 1, short: '12:30 ET', full: 'Midday 12:30' },
  { id: 2, short: '14:30 O\'Clock', full: 'Dealer O\'Clock 14:30' },
  { id: 3, short: '15:45 MOC', full: '15:45 MOC Pin' },
  { id: 4, short: '+1D Decay', full: '+1 Day Decay' },
];

const VOLLAND_COLORSCALE = [
  [0.0, '#e11d48'],
  [0.18, '#9f1239'],
  [0.34, '#581024'],
  [0.45, '#131c2e'],
  [0.5, '#070b14'],
  [0.55, '#0d1f22'],
  [0.66, '#064e3b'],
  [0.84, '#059669'],
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

const fmtShsK = (shsK) => {
  const n = Number(shsK) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(2)}M shs`;
  return `${sign}${abs.toFixed(0)}K shs`;
};

function buildQuadrantReason({ sc, lens, gammaFlowM, vannaM, charmM, gexM, tShift, netAdj }) {
  const isRally = Number(sc.price_pct || 0) >= 0;
  const isVolCrush = Number(sc.iv_shift_pct || 0) <= 0;

  if (lens === 'vanna') {
    const tag = vannaM >= 0 ? 'VANNA BID' : 'VANNA SUPPLY';
    const why = isVolCrush
      ? (vannaM >= 0
        ? `Volatility crush (${sc.iv_shift_pct}% IV) shrinks OTM put deltas, forcing dealers to cover shorts and buy ${fmtM(vannaM)}.`
        : `Volatility crush (${sc.iv_shift_pct}% IV) erodes call/wing deltas, prompting dealers to unwind long hedges (${fmtM(vannaM)}).`)
      : (vannaM < 0
        ? `Volatility spike (+${sc.iv_shift_pct}% IV) expands downside put deltas, forcing dealers to sell ${fmtM(vannaM)}.`
        : `Volatility spike (+${sc.iv_shift_pct}% IV) lifts upside call deltas, pulling dealers into ${fmtM(vannaM)} buyback.`);
    return { behaviorTag: tag, reason: why };
  }

  if (lens === 'charm') {
    const tag = charmM >= 0 ? 'DECAY BID' : 'DECAY DRAG';
    const why = charmM >= 0
      ? `Option time decay at $${Number(sc.price).toFixed(0)} causes OTM hedge deltas to bleed off, generating ${fmtM(charmM)}/d mechanical dealer buyback.`
      : `Option time decay at $${Number(sc.price).toFixed(0)} unwinds call/short-gamma delta hedges, creating ${fmtM(charmM)}/d dealer selling into close.`;
    return { behaviorTag: tag, reason: why };
  }

  if (lens === 'gex') {
    const tag = gexM >= 0 ? 'MEAN REVERT' : 'TREND CHASE';
    const why = gexM >= 0
      ? `Positive Gamma (${fmtM(gexM)}/1%): dealers dampen volatility here by mechanically buying dips and selling rallies.`
      : `Negative Gamma (${fmtM(gexM)}/1%): dealers amplify directional velocity by chasing breakouts and liquidating breakdowns.`;
    return { behaviorTag: tag, reason: why };
  }

  // Net Dealer Flow lens: Gamma (Price move) + Vanna (IV shift) + Charm (Time scrubber)
  const gText = isRally
    ? (gammaFlowM >= 0
      ? 'short-gamma squeeze covering forces dealers to buy strength'
      : 'long-gamma call-wall hedging leads dealers to sell into rallies')
    : (gammaFlowM >= 0
      ? 'long-gamma support hedging leads dealers to buy weakness'
      : 'short-gamma breakdown hedging forces dealers to sell drops');

  const vText = isVolCrush
    ? (vannaM >= 0
      ? 'IV crush shrinks put deltas triggering dealer buybacks (+Vanna)'
      : 'IV crush lowers call deltas prompting hedge unwinds (−Vanna)')
    : (vannaM < 0
      ? 'IV spike inflates put deltas forcing dealer selling (−Vanna)'
      : 'IV spike lifts call deltas pulling dealer buyback (+Vanna)');

  const sameSign = (gammaFlowM >= 0 && vannaM >= 0) || (gammaFlowM < 0 && vannaM < 0);
  const vannaDominant = Math.abs(vannaM) > Math.abs(gammaFlowM);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  let why = sameSign
    ? (vannaDominant
      ? `${cap(vText)}, reinforced as ${gText}.`
      : `${cap(gText)}, reinforced because ${vText}.`)
    : (vannaDominant
      ? `${cap(vText)}, overpowering that ${gText}.`
      : `${cap(gText)}, outweighing that ${vText}.`);

  if (Math.abs(tShift) >= 0.05) {
    why += ` Time decay adds ${fmtM(tShift)}.`;
  }

  let behaviorTag = 'BALANCED FLOW';
  if (sameSign) {
    behaviorTag = netAdj >= 0
      ? (isRally ? 'SQUEEZE FUEL' : 'DIP BUY TAILWIND')
      : (isRally ? 'SUPPLY CAP' : 'CASCADE SELL');
  } else {
    behaviorTag = netAdj >= 0
      ? (vannaDominant ? 'VANNA OVERRIDE ↑' : 'GAMMA SUPPORT')
      : (vannaDominant ? 'VANNA DRAG ↓' : 'WALL SUPPLY');
  }
  return { behaviorTag, reason: why };
}

function usePlotWidth(ref) {
  const [w, setW] = useState(1200);
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

export default function VollandFlowStudio({
  ticker,
  spot,
  volland,
  keyLevels,
  totals,
  expectedMove,
  plotlyReady,
}) {
  const [viewMode, setViewMode] = useState('studio'); // 'studio' | 'waterfall' | 'clock'
  const [lens, setLens] = useState('net_flow'); // 'net_flow' | 'vanna' | 'charm' | 'gex'
  const [scope, setScope] = useState('all'); // 'all' | 'weekly' | 'front'
  const [source, setSource] = useState('oi'); // 'oi' | 'vol'
  const [zoomMode, setZoomMode] = useState('smart'); // 'smart' | '5' | '8' | '10'
  const [smoothMode, setSmoothMode] = useState('smooth'); // 'smooth' | 'discrete'
  const [showSignals, setShowSignals] = useState(true);
  const [showLevels, setShowLevels] = useState(true);
  const [showRhoPath, setShowRhoPath] = useState(true);
  const [waterfallNorm, setWaterfallNorm] = useState(true);
  const [showWfLabels, setShowWfLabels] = useState(true);
  const [showClockSplit, setShowClockSplit] = useState(true);
  const [clockMode, setClockMode] = useState('impulse'); // 'impulse' | 'cumulative'
  const [clockIvScenario, setClockIvScenario] = useState('flat'); // 'flat' | 'crush_2' | 'spike_2'
  const [timeHorizon, setTimeHorizon] = useState(0); // 0..4
  const [showGuide, setShowGuide] = useState(false);

  const plotRef = useRef(null);
  const plotWidth = usePlotWidth(plotRef);
  const plotHeightPx = viewMode === 'studio' ? 555 : (viewMode === 'clock' ? 515 : 490);
  const spotVal = Number(spot || volland?.price_vol_heatmap?.spot_price || 0);
  const lensInfo = LENS_CFG[lens] || LENS_CFG.net_flow;

  // Resolve active scope payload cleanly (fall back to top-level v2/legacy object if scopes missing)
  const scopeData = useMemo(() => {
    const sc = volland?.scopes?.[scope];
    if (sc && sc.strikes?.length) return sc;
    return {
      expiry_label: 'All Chain',
      paradigm_name: volland?.paradigm_name || 'BIFURCATED',
      paradigm_short: volland?.paradigm_short || volland?.paradigm_name || 'VOL-TRAP',
      paradigm_color: volland?.paradigm_color || '#c084fc',
      paradigm_summary: volland?.paradigm_summary || '',
      primary_magnet: volland?.primary_magnet,
      pin_probability_pct: volland?.pin_probability_pct || 50,
      upper_resistance: volland?.upper_target || keyLevels?.call_wall,
      lower_support: volland?.lower_target || keyLevels?.put_wall,
      call_wall: keyLevels?.call_wall,
      put_wall: keyLevels?.put_wall,
      acceleration_void: volland?.acceleration_void,
      lis_price: volland?.lis_price ?? keyLevels?.zero_gamma ?? null,
      lis_note: volland?.lis_note || 'BS Flip',
      spot_gex_m: (volland?.dealer_action_1pct_down_m || 0) / 1e6,
      vanna_1vol_m: (volland?.vanna_1vol_m || 0) / 1e6,
      charm_daily_m: (volland?.net_charm_daily_m || 0) / 1e6,
      dealer_oclock_charm_m: ((volland?.net_charm_daily_m || 0) * 0.4) / 1e6,
      dealer_1pct_up_m: (volland?.dealer_action_1pct_up_m || 0) / 1e6,
      shares_per_1pct_up: 0,
      strikes: (volland?.strike_map || []).map((s) => ({
        strike: s.strike,
        pct_from_spot: s.pct_from_spot,
        gex_m: (s.gamma_pressure || 0) / 1e6,
        vex_m: (s.vanna_pressure || 0) / 1e6,
        cex_m: (s.charm_pressure || 0) / 1e6,
        net_flow_m: (s.total_volland_flow || 0) / 1e6,
        vol_gex_m: 0,
        vol_vex_m: 0,
        vol_cex_m: 0,
        vol_net_flow_m: 0,
        gex_norm: 0,
        vex_norm: 0,
        cex_norm: 0,
        gravity_pct: s.gravity_score || 0,
        role: s.role || 'NEUTRAL',
      })),
      dealer_clock: {
        slots: (volland?.intraday_flow_schedule || []).map((x, idx) => ({
          t: x.time,
          min_idx: idx * 60,
          cum_charm_m: (x.charm_flow_m || 0) / 1e6,
          front_charm_m: 0,
          multi_charm_m: (x.charm_flow_m || 0) / 1e6,
          cum_vanna_m: (x.vanna_flow_m || 0) / 1e6,
          net_flow_m: (x.net_dealer_flow_m || 0) / 1e6,
          is_dealer_oclock: idx >= 3 && idx <= 4,
        })),
        summary: { total_charm_m: 0, dealer_oclock_m: 0, front_share_pct: 0, total_vanna_m: 0, total_net_m: 0 },
      },
      price_vol_heatmap: volland?.price_vol_heatmap || {},
    };
  }, [volland, scope, keyLevels]);

  const pvh = useMemo(() => {
    const h = scopeData?.price_vol_heatmap;
    if (h?.prices?.length) return h;
    return volland?.price_vol_heatmap || {};
  }, [scopeData, volland]);

  // Resolve Price Y-Bounds (Smart frames spot + EM + nearby Magnet/LIS/Walls cleanly)
  const yBounds = useMemo(() => {
    if (!spotVal) return [0, 100];
    const pArr = pvh?.prices || [];
    const pLo = pArr.length ? pArr[0] : spotVal * 0.90;
    const pHi = pArr.length ? pArr[pArr.length - 1] : spotVal * 1.10;

    if (zoomMode !== 'smart') {
      const pct = Number(zoomMode) / 100.0;
      return [
        Number(Math.max(pLo, spotVal * (1 - pct)).toFixed(2)),
        Number(Math.min(pHi, spotVal * (1 + pct)).toFixed(2)),
      ];
    }

    const cands = [spotVal * 0.93, spotVal * 1.07];
    if (expectedMove?.range_1d?.length === 2) {
      cands.push(Number(expectedMove.range_1d[0]) * 0.985, Number(expectedMove.range_1d[1]) * 1.015);
    }
    const pushNear = (val) => {
      const n = Number(val);
      if (Number.isFinite(n) && n > 0 && Math.abs(n - spotVal) / spotVal <= 0.11) {
        cands.push(n > spotVal ? n * 1.008 : n * 0.992);
      }
    };
    pushNear(scopeData?.primary_magnet);
    pushNear(scopeData?.lis_price);
    pushNear(scopeData?.call_wall);
    pushNear(scopeData?.put_wall);

    return [
      Number(Math.max(pLo, Math.min(...cands)).toFixed(2)),
      Number(Math.min(pHi, Math.max(...cands)).toFixed(2)),
    ];
  }, [spotVal, pvh, zoomMode, expectedMove, scopeData]);

  // Apply Time-Decay Horizon Shift to Net Dealer Flow Grid & Scenario Cards
  const activeTimeShiftVec = useMemo(() => {
    const map = pvh?.time_horizon_shifts_m;
    if (!map || timeHorizon === 0) return null;
    return map[String(timeHorizon)] || null;
  }, [pvh, timeHorizon]);

  const adjustedNetGrid = useMemo(() => {
    const base = pvh?.net_flow_m || [];
    if (!activeTimeShiftVec) return base;
    return base.map((row, rIdx) => {
      const dShift = Number(activeTimeShiftVec[rIdx] || 0);
      return row.map((v) => Number((Number(v || 0) + dShift).toFixed(2)));
    });
  }, [pvh, activeTimeShiftVec]);

  // Resolve active Strike rows (respecting OI vs Volume and visible Y bounds)
  const visibleStrikes = useMemo(() => {
    const raw = scopeData?.strikes || [];
    const [yMin, yMax] = yBounds;
    const pfx = source === 'vol' ? 'vol_' : '';
    const rows = raw
      .filter((s) => s.strike >= yMin && s.strike <= yMax)
      .map((s) => ({
        ...s,
        a_gex: Number(s[`${pfx}gex_m`] ?? s.gex_m ?? 0),
        a_vex: Number(s[`${pfx}vex_m`] ?? s.vex_m ?? 0),
        a_cex: Number(s[`${pfx}cex_m`] ?? s.cex_m ?? 0),
        a_net: Number(s[`${pfx}net_flow_m`] ?? s.net_flow_m ?? 0),
      }));
    if (rows.length >= 6) return rows;
    return raw.map((s) => ({
      ...s,
      a_gex: Number(s[`${pfx}gex_m`] ?? s.gex_m ?? 0),
      a_vex: Number(s[`${pfx}vex_m`] ?? s.vex_m ?? 0),
      a_cex: Number(s[`${pfx}cex_m`] ?? s.cex_m ?? 0),
      a_net: Number(s[`${pfx}net_flow_m`] ?? s.net_flow_m ?? 0),
    }));
  }, [scopeData, yBounds, source]);

  // Peak Waterfall drivers for Market Maker Action Guide strip
  const waterfallPeaks = useMemo(() => {
    const empty = { strike: spotVal || 0, val: 0 };
    if (!visibleStrikes.length) {
      return { charm: empty, vanna: empty, gamma: empty };
    }
    const maxBy = (key) => visibleStrikes.reduce((best, cur) => (
      Math.abs(cur[key] || 0) > Math.abs(best[key] || 0) ? cur : best
    ), visibleStrikes[0]);
    const cPt = maxBy('a_cex');
    const vPt = maxBy('a_vex');
    const gPt = maxBy('a_gex');
    return {
      charm: { strike: cPt.strike, val: Number(cPt.a_cex || 0) },
      vanna: { strike: vPt.strike, val: Number(vPt.a_vex || 0) },
      gamma: { strike: gPt.strike, val: Number(gPt.a_gex || 0) },
    };
  }, [visibleStrikes, spotVal]);

  // Active Dealer Clock payload (OI vs Active Volume + Time-Scrubber Cursor + Phase Breakdown)
  const clockTelemetry = useMemo(() => {
    const useVolClock = source === 'vol' && scopeData?.vol_dealer_clock && !scopeData.vol_dealer_clock.empty && (scopeData.vol_dealer_clock.slots || []).length > 0;
    const usingVolFallback = source === 'vol' && !useVolClock;
    const rawClock = (useVolClock ? scopeData.vol_dealer_clock : scopeData?.dealer_clock) || {};
    const slots = rawClock.slots || [];
    const summary = rawClock.summary || {};

    // Determine effective IV scenario based on active top Lens + user scenario pill
    const effScenario = lens === 'charm'
      ? 'flat'
      : (lens === 'vanna' && clockIvScenario === 'flat' ? 'crush_2' : clockIvScenario);

    // Map TIME scrubber (0..4) cleanly onto 14 half-hour timestamps
    let cursorIdx = 1; // 10:00 ET default morning-early benchmark when Live outside session
    if (timeHorizon === 0) {
      try {
        const nowEt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const mins = nowEt.getHours() * 60 + nowEt.getMinutes();
        if (mins >= 570 && mins <= 960) {
          cursorIdx = Math.min(13, Math.max(0, Math.floor((mins - 570) / 30)));
        }
      } catch (_) {
        cursorIdx = 1;
      }
    } else if (timeHorizon === 1) {
      cursorIdx = 6; // 12:30 ET
    } else if (timeHorizon === 2) {
      cursorIdx = 10; // 14:30 ET
    } else if (timeHorizon === 3) {
      cursorIdx = 12; // 15:30 ET (MOC)
    } else {
      cursorIdx = 13; // 16:00 ET
    }
    cursorIdx = Math.min(Math.max(0, slots.length - 1), cursorIdx);

    const vannaCumAt = (sl) => {
      if (!sl) return 0;
      if (effScenario === 'crush_2') return Number(sl.cum_vanna_crush_m ?? sl.cum_vanna_m ?? 0);
      if (effScenario === 'spike_2') return Number(sl.cum_vanna_spike_m ?? 0);
      return 0;
    };
    const vannaStepAt = (sl) => {
      if (!sl) return 0;
      if (effScenario === 'crush_2') return Number(sl.step_vanna_crush_m ?? sl.step_vanna_base_m ?? 0);
      if (effScenario === 'spike_2') return Number(sl.step_vanna_spike_m ?? 0);
      return 0;
    };

    const series = slots.map((sl) => {
      const cumCharm = Number(sl.cum_charm_m || 0);
      const cumFront = Number(sl.front_charm_m || 0);
      const cumMulti = Number(sl.multi_charm_m || 0);
      const stepCharm = Number(sl.step_charm_m ?? 0);
      const stepFront = Number(sl.step_front_m ?? 0);
      const stepMulti = Number(sl.step_multi_m ?? 0);
      const cumVanna = lens === 'vanna' ? Number(sl.cum_vanna_crush_m ?? sl.cum_vanna_m ?? 0) : vannaCumAt(sl);
      const stepVanna = lens === 'vanna' ? Number(sl.step_vanna_crush_m ?? 0) : vannaStepAt(sl);
      const cumNet = lens === 'vanna'
        ? cumVanna
        : (lens === 'charm' ? cumCharm : Number((cumCharm + cumVanna).toFixed(2)));
      return {
        ...sl,
        cumCharm,
        cumFront,
        cumMulti,
        stepCharm,
        stepFront,
        stepMulti,
        cumVanna,
        stepVanna,
        cumVannaCrush: Number(sl.cum_vanna_crush_m ?? sl.cum_vanna_m ?? 0),
        cumVannaSpike: Number(sl.cum_vanna_spike_m ?? 0),
        stepVannaCrush: Number(sl.step_vanna_crush_m ?? 0),
        stepVannaSpike: Number(sl.step_vanna_spike_m ?? 0),
        cumNet,
      };
    });

    const curPt = series[cursorIdx] || { t: '10:00', cumNet: 0, cumCharm: 0, cumVanna: 0 };
    const endPt = series[series.length - 1] || { cumNet: 0, cumCharm: 0, cumVanna: 0 };
    const elapsedM = Number(curPt.cumNet || 0);
    const totalSessionM = Number(endPt.cumNet || 0);
    const remainingM = Number((totalSessionM - elapsedM).toFixed(2));
    const oclockPhase = (rawClock.phases || []).find((p) => p.id === 'oclock');
    const peakWin = rawClock.peak_window || { window: '—', step_charm_m: 0, share_pct: 0 };

    const gexPos = Number(scopeData?.spot_gex_m || 0) >= 0;
    const rawPhases = (rawClock.phases && rawClock.phases.length === 4) ? rawClock.phases : [
      { id: 'open', label: 'Open Rotation', window: '09:30–11:30', charm_m: 0, front_charm_m: 0, multi_charm_m: 0, vanna_crush_m: 0, vanna_spike_m: 0, share_pct: 0, is_oclock: false },
      { id: 'midday', label: 'Midday Digestion', window: '11:30–13:30', charm_m: 0, front_charm_m: 0, multi_charm_m: 0, vanna_crush_m: 0, vanna_spike_m: 0, share_pct: 0, is_oclock: false },
      { id: 'oclock', label: "Dealer O'Clock", window: '13:30–15:30', charm_m: 0, front_charm_m: 0, multi_charm_m: 0, vanna_crush_m: 0, vanna_spike_m: 0, share_pct: 0, is_oclock: true },
      { id: 'moc', label: 'MOC Unwind / Pin', window: '15:30–16:00', charm_m: 0, front_charm_m: 0, multi_charm_m: 0, vanna_crush_m: 0, vanna_spike_m: 0, share_pct: 0, is_oclock: false },
    ];

    const phaseCards = rawPhases.map((ph) => {
      const chm = Number(ph.charm_m || 0);
      const van = lens === 'charm'
        ? 0
        : (effScenario === 'crush_2'
          ? Number(ph.vanna_crush_m || 0)
          : (effScenario === 'spike_2' ? Number(ph.vanna_spike_m || 0) : 0));
      const net = lens === 'vanna' ? Number(ph.vanna_crush_m || 0) : Number((chm + van).toFixed(2));
      const fChm = Number(ph.front_charm_m || 0);
      const fShare = Math.abs(chm) > 0.05 ? Math.min(100, Math.round((Math.abs(fChm) / Math.abs(chm)) * 100)) : 0;

      let readText = '';
      if (ph.id === 'open') {
        readText = net >= 0
          ? `Morning theta bleed builds early dealer buy support (${fShare}% from ≤2D options).`
          : `Opening delta unwind forces dealer selling into initial range discovery.`;
      } else if (ph.id === 'midday') {
        readText = `${Math.abs(net) < Math.abs(totalSessionM) * 0.25 ? 'Lower-velocity midday consolidation' : 'Steady midday hedge rebalance'} ahead of afternoon Dealer O'Clock.`;
      } else if (ph.id === 'oclock') {
        readText = `Peak 0DTE/theta window (${ph.share_pct}% of Charm): ${net >= 0 ? 'mechanical afternoon bid pins dips toward' : 'afternoon delta unwind pressures moves toward'} ${scopeData?.primary_magnet ? `$${scopeData.primary_magnet}` : 'magnet'}.`;
      } else {
        readText = gexPos
          ? `Long-gamma pin window into closing auction ($${scopeData?.primary_magnet || '--'}); late delta bleed settles cleanly.`
          : `Negative-gamma close window: MOC imbalances + final delta cleanup can trigger fast late-day swings.`;
      }

      return {
        ...ph,
        charmVal: chm,
        vannaVal: van,
        netVal: net,
        isPos: net >= 0,
        frontSharePct: fShare,
        readText,
      };
    });

    const effText = remainingM > 0.25
      ? `Dealers still have ${fmtM(remainingM)} of net BUY hedges into 16:00 ET (${gexPos ? 'supports dips toward Magnet' : 'tailwind if spot stabilizes'}).`
      : (remainingM < -0.25
        ? `Dealers still owe ${fmtM(remainingM)} of SELL hedges into 16:00 ET (${gexPos ? 'caps bounces' : 'adds afternoon downside drag'}).`
        : 'Remaining intraday Charm/Vanna drift into close is near neutral balance.');

    return {
      sourceLabel: useVolClock ? 'Active Volume Book' : (usingVolFallback ? 'OI Fallback (Vol 0)' : 'Structural OI Book'),
      usingVolFallback,
      effScenario,
      cursorIdx,
      cursorTime: curPt.t || '10:00',
      elapsedM,
      remainingM,
      totalSessionM,
      frontSharePct: Number(summary.front_share_pct ?? 0),
      oclockSharePct: Number(summary.oclock_share_pct ?? oclockPhase?.share_pct ?? 0),
      peakWin,
      series,
      phaseCards,
      effText,
      rawSummary: summary,
    };
  }, [source, scopeData, lens, clockIvScenario, timeHorizon]);

  // Scenario cards synced with lens + timeHorizon + Gamma/Vanna/Charm reasons
  const scenarioCards = useMemo(() => {
    const baseCards = pvh?.scenarios || [];
    return baseCards.map((sc) => {
      const rIdx = sc.row_idx ?? 0;
      const tShift = activeTimeShiftVec ? Number(activeTimeShiftVec[rIdx] || 0) : 0;
      const baseNet = Number(sc.net_flow_m || 0);
      const vannaM = Number(sc.vanna_flow_m || 0);
      const gammaFlowM = Number((baseNet - vannaM).toFixed(2));
      const charmM = Number(sc.charm_flow_m || 0);
      const gexM = Number(sc.gex_m || 0);
      const netAdj = Number((baseNet + tShift).toFixed(2));

      let valM = netAdj;
      let subMetric = `Van ${fmtM(vannaM)}`;
      if (lens === 'vanna') {
        valM = vannaM;
        subMetric = `Net ${fmtM(netAdj)}`;
      } else if (lens === 'charm') {
        valM = charmM;
        subMetric = `Net ${fmtM(netAdj)}`;
      } else if (lens === 'gex') {
        valM = gexM;
        subMetric = `Flow ${fmtM(netAdj)}`;
      }
      const { behaviorTag, reason } = buildQuadrantReason({
        sc,
        lens,
        gammaFlowM,
        vannaM,
        charmM,
        gexM,
        tShift,
        netAdj,
      });
      const compactSub = `${sc.price_pct >= 0 ? '+' : ''}${Math.round(sc.price_pct)}% · ${sc.iv_shift_pct >= 0 ? '+' : ''}${sc.iv_shift_pct}% IV ($${Number(sc.price).toFixed(0)})`;
      return {
        ...sc,
        displayValM: valM,
        isPositive: valM >= 0,
        gammaFlowM,
        vannaM,
        tShift,
        behaviorTag,
        reason,
        compactSub,
        subMetric,
      };
    });
  }, [pvh, activeTimeShiftVec, lens]);

  const handleExportPng = () => {
    if (!plotRef.current || !window.Plotly) return;
    try {
      window.Plotly.downloadImage(plotRef.current, {
        format: 'png',
        width: 1600,
        height: 920,
        filename: `${ticker}_Volland_Studio_${viewMode}_${lens}`,
      });
    } catch (e) {
      console.warn('Volland Studio PNG export failed:', e);
    }
  };

  useEffect(() => {
    if (!plotlyReady || !plotRef.current || !window.Plotly || !volland || !spotVal) return undefined;

    const plotEl = plotRef.current;
    const isNarrow = plotWidth < 860;
    const [yMin, yMax] = yBounds;
    const ySpan = Math.max(0.5, yMax - yMin);
    const isDarkText = (bg) => bg === '#ffffff' || bg === '#00E676' || bg === '#00F0FF' || bg === '#fbbf24' || bg === '#f59e0b';

    const buildLevelSpecs = () => {
      const list = [
        { val: spotVal, label: `SPOT $${spotVal.toFixed(1)}`, bg: '#ffffff', line: 'rgba(255,255,255,0.88)', dash: 'dash', w: 1.9 },
      ];
      if (scopeData?.primary_magnet && scopeData.primary_magnet >= yMin && scopeData.primary_magnet <= yMax) {
        list.push({ val: Number(scopeData.primary_magnet), label: `MAG $${Number(scopeData.primary_magnet).toFixed(0)}`, bg: '#f59e0b', line: 'rgba(245,158,11,0.72)', dash: 'dot', w: 1.5 });
      }
      if (scopeData?.call_wall && scopeData.call_wall >= yMin && scopeData.call_wall <= yMax) {
        list.push({ val: Number(scopeData.call_wall), label: `CW $${Number(scopeData.call_wall).toFixed(0)}`, bg: '#00E676', line: 'rgba(0,230,118,0.68)', dash: 'dot', w: 1.4 });
      }
      if (scopeData?.put_wall && scopeData.put_wall >= yMin && scopeData.put_wall <= yMax) {
        list.push({ val: Number(scopeData.put_wall), label: `PW $${Number(scopeData.put_wall).toFixed(0)}`, bg: '#ff3366', line: 'rgba(255,51,102,0.72)', dash: 'dot', w: 1.4 });
      }
      if (scopeData?.lis_price && scopeData.lis_price >= yMin && scopeData.lis_price <= yMax) {
        list.push({ val: Number(scopeData.lis_price), label: `LIS $${Number(scopeData.lis_price).toFixed(1)}`, bg: '#00F0FF', line: '#00F0FF', dash: 'dashdot', w: 1.8 });
      }
      return list;
    };

    try {
      // =========================================================================
      // VIEW 1: DUAL SYNCHRONIZED VOLLAND STUDIO (WATERFALL + 2D SURFACE + CLOCK)
      // =========================================================================
      if (viewMode === 'studio') {
        const yAll = pvh?.prices || [];
        const xIv = pvh?.iv_shifts_pct || [];
        const rawMatM = lens === 'vanna'
          ? (pvh?.vanna_flow_m || [])
          : (lens === 'charm'
            ? (pvh?.charm_flow_m || [])
            : (lens === 'gex' ? (pvh?.gex_regime_m || []) : adjustedNetGrid));

        const rowIndices = [];
        yAll.forEach((p, idx) => {
          if (p >= yMin - ySpan * 0.05 && p <= yMax + ySpan * 0.05) rowIndices.push(idx);
        });
        const visPrices = rowIndices.length >= 4 ? rowIndices.map((i) => yAll[i]) : yAll;
        const visMatM = rowIndices.length >= 4 ? rowIndices.map((i) => rawMatM[i] || []) : rawMatM;

        const flatAbsM = visMatM.flat().map((v) => Math.abs(Number(v) || 0)).filter(Number.isFinite).sort((a, b) => a - b);
        const p96M = flatAbsM.length ? flatAbsM[Math.min(flatAbsM.length - 1, Math.floor(flatAbsM.length * 0.96))] : 1.0;
        const useBillions = p96M >= 1000;
        const zDiv = useBillions ? 1000.0 : 1.0;
        const visMatScaled = visMatM.map((row) => row.map((v) => Number((Number(v || 0) / zDiv).toFixed(3))));
        const zBound = Math.max(p96M / zDiv, 0.25);

        const hmHover = visPrices.map((p, rLoc) => {
          const origR = rowIndices.length >= 4 ? rowIndices[rLoc] : rLoc;
          const dp = spotVal > 0 ? ((p - spotVal) / spotVal) * 100 : 0;
          const atmIvPct = Number(pvh?.atm_iv_pct || expectedMove?.atm_iv_pct || 25);
          return xIv.map((divPct, cIdx) => {
            const valM = Number(visMatM[rLoc]?.[cIdx] ?? 0);
            const nfM = Number(adjustedNetGrid[origR]?.[cIdx] ?? valM);
            const vfM = Number(pvh?.vanna_flow_m?.[origR]?.[cIdx] ?? 0);
            const cfM = Number(pvh?.charm_flow_m?.[origR]?.[cIdx] ?? 0);
            const shsK = Number(pvh?.hedge_shares_k?.[origR]?.[cIdx] ?? 0);
            const simIv = Math.max(1, atmIvPct + divPct).toFixed(1);
            return `<b>$${Number(p).toFixed(2)}</b> (${dp >= 0 ? '+' : ''}${dp.toFixed(1)}% vs Spot) · <b>${divPct >= 0 ? '+' : ''}${divPct}% IV</b> (Sim ${simIv}%)<br>` +
                   `${lensInfo.label}: <b>${fmtM(valM)}</b>${lens === 'net_flow' ? ` (${fmtShsK(shsK)})` : ''}<br>` +
                   `<span style="color:#94a3b8">Net: ${fmtM(nfM)} · Vanna: ${fmtM(vfM)} · Charm: ${fmtM(cfM)}/d</span><br>` +
                   `<b>${valM >= 0 ? lensInfo.posMeaning : lensInfo.negMeaning}</b>`;
          });
        });

        // Left Horizontal Strike Waterfall series matching selected Lens & Source
        const sArr = visibleStrikes.map((s) => s.strike);
        let minStep = ySpan * 0.05;
        for (let i = 1; i < sArr.length; i += 1) {
          const d = sArr[i] - sArr[i - 1];
          if (d > 0 && d < minStep) minStep = d;
        }
        const barW = Math.max(ySpan * 0.014, Math.min(minStep * 0.72, ySpan * 0.048));
        const ladderRawVals = visibleStrikes.map((s) => (
          lens === 'vanna' ? s.a_vex : (lens === 'charm' ? s.a_cex : (lens === 'gex' ? s.a_gex : s.a_net))
        ));
        const ladMaxM = Math.max(...ladderRawVals.map((v) => Math.abs(v)), 0.1);
        const ladUseB = ladMaxM >= 1000;
        const ladDiv = ladUseB ? 1000.0 : 1.0;

        const leftEnd = isNarrow ? 0.235 : 0.225;
        const centerStart = isNarrow ? 0.305 : 0.275;
        const centerEnd = isNarrow ? 0.805 : 0.858;
        const badgeX = centerEnd + 0.006;
        const cbX = isNarrow ? 0.935 : 0.952;

        const traces = [
          // 1. Left Horizontal Strike Waterfall Bars
          {
            type: 'bar',
            orientation: 'h',
            name: `${source === 'vol' ? 'Vol' : 'OI'} ${lensInfo.short}`,
            x: ladderRawVals.map((v) => Number((v / ladDiv).toFixed(3))),
            y: sArr,
            width: barW,
            xaxis: 'x',
            yaxis: 'y',
            marker: {
              color: ladderRawVals.map((v) => (v >= 0 ? lensInfo.posColor : lensInfo.negColor)),
              opacity: 0.9,
              line: { width: 0 },
            },
            customdata: visibleStrikes.map((s, idx) => [s.pct_from_spot, ladderRawVals[idx], s.gravity_pct, s.role]),
            hovertemplate:
              '<b>Strike $%{y:.2f}</b> (%{customdata[0]:+.1f}%) · %{customdata[3]}<br>' +
              `${lensInfo.short}: <b>%{customdata[1]:+.2f}M</b> · Pin Gravity: <b>%{customdata[2]:.1f}%</b><extra></extra>`,
          },
          // 2. Pinning Gravity Halo Envelope + Primary Magnet Star (cleanly frames left waterfall without noisy sawtooth)
          {
            type: 'scatter',
            mode: 'lines',
            name: 'Pin Gravity Halo',
            x: visibleStrikes.map((s) => s.gravity_pct),
            y: sArr,
            xaxis: 'x4',
            yaxis: 'y',
            fill: 'tozerox',
            fillcolor: 'rgba(251, 191, 36, 0.10)',
            line: { color: 'rgba(251, 191, 36, 0.58)', width: 1.4 },
            hovertemplate: 'Strike $%{y:.2f} · Pin Gravity: <b>%{x:.1f}%</b><extra></extra>',
          },
          ...(scopeData?.primary_magnet ? [{
            type: 'scatter',
            mode: 'markers',
            name: 'Magnet Pin',
            x: [visibleStrikes.find((s) => s.strike === scopeData.primary_magnet)?.gravity_pct ?? 95],
            y: [scopeData.primary_magnet],
            xaxis: 'x4',
            yaxis: 'y',
            marker: { symbol: 'diamond', size: 8, color: '#fbbf24', line: { color: '#040812', width: 1 } },
            showlegend: false,
            hovertemplate: `<b>Primary Magnet $${scopeData.primary_magnet}</b><extra></extra>`,
          }] : []),
        ];

        // 3. Center 2D Price x ΔIV Heatmap
        if (visPrices.length && xIv.length) {
          traces.push({
            type: 'heatmap',
            name: lensInfo.label,
            x: xIv,
            y: visPrices,
            z: visMatScaled,
            text: hmHover,
            hoverinfo: 'text',
            xaxis: 'x2',
            yaxis: 'y2',
            zsmooth: smoothMode === 'smooth' ? 'best' : false,
            zmin: -zBound,
            zmax: zBound,
            zmid: 0,
            colorscale: VOLLAND_COLORSCALE,
            colorbar: {
              title: { text: `${lensInfo.short} (${useBillions ? '$B' : '$M'})`, font: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 9.5 } },
              tickfont: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 8.5 },
              ticksuffix: useBillions ? 'B' : 'M',
              x: cbX,
              xanchor: 'left',
              len: 0.72,
              y: 0.615,
              yanchor: 'middle',
              thickness: isNarrow ? 10 : 12,
              outlinewidth: 0,
            },
          });

          // $0M Flow Equilibrium / Regime Flip Contour
          traces.push({
            type: 'contour',
            x: xIv,
            y: visPrices,
            z: visMatScaled,
            xaxis: 'x2',
            yaxis: 'y2',
            autocontour: false,
            contours: { start: 0, end: 0, size: 1, coloring: 'none' },
            line: { color: '#fbbf24', width: 2.2 },
            showscale: false,
            hoverinfo: 'skip',
            name: '$0 Equilibrium',
          });
        }

        // Expected Spot-Vol Co-Movement Trajectory (ρ)
        const svPath = (pvh?.spot_vol_path || []).filter((pt) => pt.price >= yMin && pt.price <= yMax);
        if (showRhoPath && svPath.length >= 2) {
          traces.push({
            type: 'scatter',
            mode: 'lines',
            name: `Spot–Vol Path (ρ=${Number(pvh.spot_vol_corr ?? totals?.spot_vol_corr ?? -0.55).toFixed(2)})`,
            x: svPath.map((pt) => pt.iv_shift_pct),
            y: svPath.map((pt) => pt.price),
            xaxis: 'x2',
            yaxis: 'y2',
            line: { color: '#00F0FF', width: 2.4, dash: 'dot' },
            hovertemplate: 'Expected Spot–Vol Path: <b>$%{y:.2f}</b> @ %{x:+.1f}% IV<extra></extra>',
          });
        }

        // LIVE Crosshair & Star Marker
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x: [0, 0],
          y: [yMin, yMax],
          xaxis: 'x2',
          yaxis: 'y2',
          line: { color: 'rgba(255,255,255,0.45)', width: 1.2, dash: 'dash' },
          showlegend: false,
          hoverinfo: 'skip',
        });
        traces.push({
          type: 'scatter',
          mode: 'markers',
          name: 'LIVE',
          x: [0],
          y: [spotVal],
          xaxis: 'x2',
          yaxis: 'y2',
          marker: { symbol: 'star', size: 11, color: '#ffffff', line: { color: '#040812', width: 1.2 } },
          showlegend: false,
          hovertemplate: `LIVE Spot: <b>$${spotVal.toFixed(2)}</b> @ 0% ΔIV<extra></extra>`,
        });

        // 4. Bottom Center Subplot: Real BS Intraday Dealer O'Clock Timeline (09:30 -> 16:00 ET)
        const clockSlots = scopeData?.dealer_clock?.slots || [];
        const clockSum = scopeData?.dealer_clock?.summary || {};
        const maxClockM = clockSlots.length ? Math.max(...clockSlots.map((sl) => Math.abs(sl.net_flow_m || 0)), 0.1) : 1;
        const clkUseB = maxClockM >= 1000;
        const clkDiv = clkUseB ? 1000.0 : 1.0;

        if (clockSlots.length > 0) {
          traces.push({
            type: 'scatter',
            mode: 'lines',
            name: `O'Clock Flow (${clkUseB ? '$B' : '$M'})`,
            x: clockSlots.map((sl) => sl.min_idx),
            y: clockSlots.map((sl) => Number(((sl.net_flow_m || 0) / clkDiv).toFixed(3))),
            xaxis: 'x3',
            yaxis: 'y3',
            fill: 'tozeroy',
            fillcolor: (clockSum.total_net_m || 0) >= 0 ? 'rgba(0, 230, 118, 0.20)' : 'rgba(255, 51, 102, 0.20)',
            line: { color: (clockSum.total_net_m || 0) >= 0 ? '#00E676' : '#ff3366', width: 2.2 },
            customdata: clockSlots.map((sl) => [sl.t, fmtM(sl.net_flow_m), fmtM(sl.cum_charm_m), fmtM(sl.cum_vanna_m), fmtM(sl.front_charm_m)]),
            hovertemplate:
              '<b>%{customdata[0]} ET</b><br>' +
              'Cumulative Net Drift: <b>%{customdata[1]}</b><br>' +
              '<span style="color:#c084fc">Charm: %{customdata[2]}</span> (0DTE %{customdata[4]}) · <span style="color:#22d3ee">Vanna: %{customdata[3]}</span><extra></extra>',
          });
        }

        const shapes = [];
        const annotations = [];

        // Translucent Gold Highlight Band for 13:30-15:30 ET Dealer O'Clock Window on Bottom Timeline
        shapes.push({
          type: 'rect',
          xref: 'x3',
          yref: 'y3 domain',
          x0: 240, // 13:30 ET
          x1: 360, // 15:30 ET
          y0: 0,
          y1: 1,
          fillcolor: 'rgba(251, 191, 36, 0.08)',
          line: { color: 'rgba(251, 191, 36, 0.3)', width: 1, dash: 'dot' },
        });
        annotations.push({
          xref: 'x3',
          yref: 'y3 domain',
          x: 300,
          y: 0.96,
          text: '<b>DEALER O\'CLOCK</b>',
          showarrow: false,
          yanchor: 'top',
          font: { color: '#fbbf24', size: 8, family: 'JetBrains Mono, monospace' },
        });

        // Horizontal Key Level Lines & De-overlapped Right Badges
        if (showLevels) {
          const placedNy = [];
          buildLevelSpecs().forEach((lvl) => {
            shapes.push({
              type: 'line',
              xref: 'x2',
              yref: 'y2',
              x0: -10,
              x1: 10,
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
              line: { color: lvl.line, width: Math.max(1, lvl.w * 0.75), dash: lvl.dash },
            });
            const ny = (lvl.val - yMin) / ySpan;
            if (!placedNy.some((pny) => Math.abs(pny - ny) < 0.06) && ny >= 0.03 && ny <= 0.97) {
              placedNy.push(ny);
              annotations.push({
                xref: 'paper',
                x: badgeX,
                yref: 'y2',
                y: lvl.val,
                text: `<b>${lvl.label}</b>`,
                showarrow: false,
                font: { color: isDarkText(lvl.bg) ? '#040812' : '#ffffff', size: isNarrow ? 8.2 : 9, family: 'JetBrains Mono, monospace' },
                bgcolor: lvl.bg,
                borderpad: 2.5,
                xanchor: 'left',
                yanchor: 'middle',
              });
            }
          });
        }

        // Clamped Non-Overlapping Buy/Sell Signal Triangle Beacons + Compact Callouts inside visible bounds
        const rawSigs = (pvh?.trade_signals || []).filter((s) => s.price >= yMin + 0.025 * ySpan && s.price <= yMax - 0.025 * ySpan);
        if (showSignals && rawSigs.length > 0) {
          const placedSigs = [{ nx: 0.5, ny: (spotVal - yMin) / ySpan }];
          const placedCalloutBoxes = [];
          const activeSigs = [];
          const boxW = isNarrow ? 0.27 : 0.23; // generous normalized ΔIV width for label pill
          const boxH = 0.11;
          rawSigs.slice(0, 4).forEach((sig) => {
            const ivX = Number(sig.iv_shift_pct || 0);
            const nx = (ivX + 10) / 20.0;
            const ny = (sig.price - yMin) / ySpan;
            if (placedSigs.some((ps) => Math.abs(ps.nx - nx) < 0.20 && Math.abs(ps.ny - ny) < 0.12)) return;
            placedSigs.push({ nx, ny });

            const rowIndexEst = Math.max(0, Math.min(24, Math.round(((sig.price_pct + 10) / 20) * 24)));
            const valSig = lens === 'vanna'
              ? sig.vanna_flow_m
              : (lens === 'charm'
                ? sig.charm_flow_m
                : (Number(sig.net_flow_m || 0) + (activeTimeShiftVec ? Number(activeTimeShiftVec[rowIndexEst] || 0) : 0)));
            const isBuy = valSig >= 0;
            activeSigs.push({ ...sig, ivX, ny, valSig, isBuy });

            // Outward horizontal placement keeps opposing-IV callouts apart & inside [-10%, +10%]
            const xCandidates = [];
            if (ivX <= -4) {
              xCandidates.push({ ax: 12, xanchor: 'left' }, { ax: -10, xanchor: 'right' });
            } else if (ivX < 0) {
              xCandidates.push({ ax: -12, xanchor: 'right' }, { ax: 12, xanchor: 'left' });
            } else if (ivX <= 4) {
              xCandidates.push({ ax: 14, xanchor: 'left' }, { ax: -14, xanchor: 'right' });
            } else {
              xCandidates.push({ ax: -12, xanchor: 'right' }, { ax: 12, xanchor: 'left' });
            }

            const yCandidates = ny > 0.68
              ? [{ ay: 20, yanchor: 'top' }, { ay: -20, yanchor: 'bottom' }, { ay: 44, yanchor: 'top' }]
              : ny < 0.30
                ? [{ ay: -20, yanchor: 'bottom' }, { ay: -44, yanchor: 'bottom' }, { ay: 20, yanchor: 'top' }]
                : [{ ay: -20, yanchor: 'bottom' }, { ay: 20, yanchor: 'top' }, { ay: -44, yanchor: 'bottom' }, { ay: 44, yanchor: 'top' }];

            let chosen = { ...xCandidates[0], ...yCandidates[0] };
            let foundClear = false;
            for (const xc of xCandidates) {
              for (const yc of yCandidates) {
                const bx0 = xc.xanchor === 'left' ? nx + 0.025 : nx - 0.025 - boxW;
                const bx1 = bx0 + boxW;
                const by0 = yc.yanchor === 'bottom' ? ny + (Math.abs(yc.ay) / 360) : ny - (Math.abs(yc.ay) / 360) - boxH;
                const by1 = by0 + boxH;
                if (bx0 < 0.01 || bx1 > 0.99 || by0 < 0.03 || by1 > 0.97) continue;
                const overlaps = placedCalloutBoxes.some((b) => !(bx1 < b.x0 || bx0 > b.x1 || by1 < b.y0 || by0 > b.y1));
                if (!overlaps) {
                  chosen = { ...xc, ...yc };
                  placedCalloutBoxes.push({ x0: bx0 - 0.015, x1: bx1 + 0.015, y0: by0 - 0.015, y1: by1 + 0.015 });
                  foundClear = true;
                  break;
                }
              }
              if (foundClear) break;
            }
            if (!foundClear) {
              const bx0 = chosen.xanchor === 'left' ? nx + 0.025 : nx - 0.025 - boxW;
              const by0 = chosen.yanchor === 'bottom' ? ny + 0.05 : ny - 0.05 - boxH;
              placedCalloutBoxes.push({ x0: bx0, x1: bx0 + boxW, y0: by0, y1: by0 + boxH });
            }

            const brd = isBuy ? '#00E676' : '#ff3366';
            annotations.push({
              xref: 'x2',
              yref: 'y2',
              x: ivX,
              y: sig.price,
              text: `<b>${sig.short_label}</b> · $${Number(sig.price).toFixed(0)} (${fmtM(valSig)})`,
              showarrow: true,
              arrowhead: 2,
              arrowsize: 0.7,
              arrowwidth: 1.2,
              arrowcolor: brd,
              ax: chosen.ax,
              ay: chosen.ay,
              xanchor: chosen.xanchor,
              yanchor: chosen.yanchor,
              font: { color: '#ffffff', size: isNarrow ? 7.8 : 8.6, family: 'JetBrains Mono, monospace' },
              bgcolor: isBuy ? 'rgba(6, 78, 59, 0.94)' : 'rgba(127, 29, 29, 0.94)',
              bordercolor: brd,
              borderwidth: 1,
              borderpad: 2.5,
            });
          });

          const buySigs = activeSigs.filter((s) => s.isBuy);
          const sellSigs = activeSigs.filter((s) => !s.isBuy);
          if (buySigs.length > 0) {
            traces.push({
              type: 'scatter',
              mode: 'markers',
              name: 'Buy Beacons',
              x: buySigs.map((s) => s.ivX),
              y: buySigs.map((s) => s.price),
              xaxis: 'x2',
              yaxis: 'y2',
              showlegend: false,
              marker: { symbol: 'triangle-up', size: 11, color: '#00E676', line: { color: '#ffffff', width: 1.3 } },
              hovertemplate: '<b>BUY Beacon</b> · $%{y:.2f} @ %{x:+.0f}% IV<extra></extra>',
            });
          }
          if (sellSigs.length > 0) {
            traces.push({
              type: 'scatter',
              mode: 'markers',
              name: 'Sell Beacons',
              x: sellSigs.map((s) => s.ivX),
              y: sellSigs.map((s) => s.price),
              xaxis: 'x2',
              yaxis: 'y2',
              showlegend: false,
              marker: { symbol: 'triangle-down', size: 11, color: '#ff3366', line: { color: '#ffffff', width: 1.3 } },
              hovertemplate: '<b>SELL Beacon</b> · $%{y:.2f} @ %{x:+.0f}% IV<extra></extra>',
            });
          }
        }

        // Responsive Left-Bottom VOLLAND PARADIGM DESK Card
        const ocVal = Number(scopeData?.dealer_oclock_charm_m || 0);
        const ocCol = ocVal >= 0 ? '#00E676' : '#ff3366';
        const up1M = Number(scopeData?.dealer_1pct_up_m || 0);
        const fShare = clockSum.front_share_pct ?? 0;

        shapes.push({
          type: 'rect',
          xref: 'paper',
          yref: 'paper',
          x0: 0.0,
          x1: leftEnd,
          y0: 0.0,
          y1: 0.19,
          fillcolor: 'rgba(12, 18, 30, 0.94)',
          line: { color: 'rgba(192, 132, 252, 0.30)', width: 1 },
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
          text: isNarrow
            ? `<b style="color:#c084fc">PARADIGM DESK</b><br>` +
              `<b style="color:${scopeData.paradigm_color}">${scopeData.paradigm_short}</b><br>` +
              `O'Clock: <b style="color:${ocCol}">${fmtM(ocVal)}</b><br>` +
              `+1% Spot: <b>${fmtM(up1M)}</b>`
            : `<b style="color:#c084fc">VOLLAND PARADIGM DESK</b><br>` +
              `Mode: <b style="color:${scopeData.paradigm_color}">${scopeData.paradigm_short}</b><br>` +
              `O'Clock: <b style="color:${ocCol}">${fmtM(ocVal)}</b> (${fShare}% 0DTE)<br>` +
              `+1% Spot: <b>${up1M >= 0 ? 'BUY ' : 'SELL '}${fmtM(Math.abs(up1M)).replace('+', '')}</b><br>` +
              `Void: <b style="color:#f59e0b">$${scopeData.acceleration_void || '--'}</b>`,
        });

        const layout = {
          paper_bgcolor: '#060910',
          plot_bgcolor: '#070b14',
          height: plotHeightPx,
          margin: { l: isNarrow ? 56 : 64, r: isNarrow ? 74 : 88, t: 48, b: 42 },
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
            font: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 8.8 : 9.8 },
            bgcolor: 'rgba(6, 9, 16, 0.75)',
          },
          xaxis: {
            domain: [0.0, leftEnd],
            anchor: 'y',
            title: { text: `${lensInfo.short} (${ladUseB ? '$B' : '$M'})`, font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 9.5 }, standoff: 5 },
            nticks: 4,
            ticksuffix: ladUseB ? 'B' : 'M',
            tickfont: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 8.5 },
            gridcolor: 'rgba(255,255,255,0.05)',
            zeroline: true,
            zerolinecolor: '#64748b',
            zerolinewidth: 1.4,
          },
          xaxis4: {
            overlaying: 'x',
            side: 'top',
            range: [0, 105],
            showticklabels: false,
            showgrid: false,
            zeroline: false,
          },
          yaxis: {
            domain: [0.27, 0.98],
            range: [yMin, yMax],
            tickprefix: '$',
            tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 9 : 10 },
            gridcolor: 'rgba(255,255,255,0.06)',
          },
          xaxis2: {
            domain: [centerStart, centerEnd],
            anchor: 'y2',
            tickvals: [-10, -6, -2, 0, 2, 6, 10],
            showticklabels: true,
            ticktext: ['-10% IV', '-6%', '-2%', '0% Live', '+2%', '+6%', '+10% IV'],
            tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 8.5 },
            side: 'bottom',
            gridcolor: 'rgba(255,255,255,0.04)',
          },
          yaxis2: {
            domain: [0.27, 0.98],
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
            tickvals: [0, 60, 120, 180, 240, 300, 390],
            ticktext: ['09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '16:00'],
            tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 9 },
            title: { text: `Dealer O'Clock Intraday Charm + Vanna Drift (${scopeData?.expiry_label})`, font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 9.5 }, standoff: 4 },
            gridcolor: 'rgba(255,255,255,0.05)',
          },
          yaxis3: {
            domain: [0.02, 0.18],
            anchor: 'x3',
            title: { text: `Clock (${clkUseB ? '$B' : '$M'})`, font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 8.5 }, standoff: 3 },
            ticksuffix: clkUseB ? 'B' : 'M',
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
      // VIEW 2: FULL-WIDTH MULTI-GREEK STRIKE WATERFALL (NORMALIZED VS RAW $M)
      // =========================================================================
      if (viewMode === 'waterfall') {
        const sStrikes = visibleStrikes.map((s) => `$${s.strike}`);
        const numStrikes = visibleStrikes.map((s) => s.strike);

        const maxVolG = Math.max(...visibleStrikes.map((s) => Math.abs(s.a_gex)), 0.01);
        const maxVolV = Math.max(...visibleStrikes.map((s) => Math.abs(s.a_vex)), 0.01);
        const maxVolC = Math.max(...visibleStrikes.map((s) => Math.abs(s.a_cex)), 0.01);

        const gSeries = waterfallNorm
          ? visibleStrikes.map((s) => (source === 'vol' ? Number(((s.a_gex / maxVolG) * 100).toFixed(1)) : s.gex_norm))
          : visibleStrikes.map((s) => s.a_gex);
        const vSeries = waterfallNorm
          ? visibleStrikes.map((s) => (source === 'vol' ? Number(((s.a_vex / maxVolV) * 100).toFixed(1)) : s.vex_norm))
          : visibleStrikes.map((s) => s.a_vex);
        const cSeries = waterfallNorm
          ? visibleStrikes.map((s) => (source === 'vol' ? Number(((s.a_cex / maxVolC) * 100).toFixed(1)) : s.cex_norm))
          : visibleStrikes.map((s) => s.a_cex);

        const gammaAct = (v) => (v >= 0 ? '🟢 MM PIN: Buy dips / Sell rallies' : '🔴 MM CHASE: Sell dips / Buy rallies');
        const vannaAct = (v) => (v >= 0 ? '▲ MM BUY on IV↓ (Sell on IV↑)' : '▼ MM SELL on IV↓ (Buy on IV↑)');
        const charmAct = (v) => (v >= 0 ? '▲ MM MUST BUY (Time Decay Bid)' : '▼ MM MUST SELL (Time Decay Supply)');

        const allBarVals = [...gSeries, ...vSeries, ...cSeries].map((v) => Number(v) || 0);
        const yMinRaw = Math.min(0, ...allBarVals);
        const yMaxRaw = Math.max(0, ...allBarVals);
        const ySpanWf = Math.max(10, yMaxRaw - yMinRaw);
        const yLoWf = yMinRaw < 0 ? yMinRaw - ySpanWf * 0.22 : -(yMaxRaw * 0.1 || 5);
        const yHiWf = yMaxRaw > 0 ? yMaxRaw + ySpanWf * 0.24 : (Math.abs(yMinRaw) * 0.1 || 5);

        const traces = [
          {
            type: 'bar',
            name: waterfallNorm ? 'Gamma (Norm %)' : 'Gamma ($M)',
            x: numStrikes,
            y: gSeries,
            marker: { color: '#00E676', opacity: 0.85 },
            customdata: visibleStrikes.map((s) => [fmtM(s.a_gex), fmtM(s.a_vex), fmtM(s.a_cex), gammaAct(s.a_gex), s.role]),
            hovertemplate:
              '<b>Strike $%{x:.2f}</b> · %{customdata[4]}<br>' +
              'Gamma (GEX): <b>%{customdata[0]}</b><br>' +
              'Action: <b>%{customdata[3]}</b><br>' +
              'VEX: %{customdata[1]} · CEX: %{customdata[2]}/d<extra></extra>',
          },
          {
            type: 'bar',
            name: waterfallNorm ? 'Vanna (Norm %)' : 'Vanna ($M)',
            x: numStrikes,
            y: vSeries,
            marker: { color: '#22d3ee', opacity: 0.88 },
            customdata: visibleStrikes.map((s) => [fmtM(s.a_vex), fmtM(s.a_gex), fmtM(s.a_cex), vannaAct(s.a_vex)]),
            hovertemplate:
              '<b>Strike $%{x:.2f}</b><br>' +
              'Vanna (VEX): <b>%{customdata[0]}</b><br>' +
              'Action: <b>%{customdata[3]}</b><br>' +
              'GEX: %{customdata[1]} · CEX: %{customdata[2]}/d<extra></extra>',
          },
          {
            type: 'bar',
            name: waterfallNorm ? 'Charm (Norm %)' : 'Charm ($M/d)',
            x: numStrikes,
            y: cSeries,
            marker: { color: '#c084fc', opacity: 0.9 },
            customdata: visibleStrikes.map((s) => [fmtM(s.a_cex), fmtM(s.a_gex), fmtM(s.a_vex), charmAct(s.a_cex)]),
            hovertemplate:
              '<b>Strike $%{x:.2f}</b><br>' +
              'Charm Flow (CEX): <b>%{customdata[0]}/d</b><br>' +
              'Action: <b>%{customdata[3]}</b><br>' +
              'GEX: %{customdata[1]} · VEX: %{customdata[2]}<extra></extra>',
          },
          {
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Pinning Gravity %',
            x: numStrikes,
            y: visibleStrikes.map((s) => s.gravity_pct),
            yaxis: 'y2',
            line: { color: '#fbbf24', width: 2.8 },
            marker: { size: 5, color: '#fbbf24' },
            hovertemplate: 'Strike $%{x:.2f} · Pin Gravity: <b>%{y:.1f}%</b><extra></extra>',
          },
        ];

        const shapes = [];
        const annotations = [];
        const xMinW = numStrikes.length ? Math.min(...numStrikes) : 0;
        const xMaxW = numStrikes.length ? Math.max(...numStrikes) : 1;
        const xSpanW = Math.max(1, xMaxW - xMinW);

        // Collision-free crisp MM BUY / SELL callout pills anchored directly to strongest bars
        if (showWfLabels && numStrikes.length) {
          const candidates = [];
          const pushTopBars = (vals, posText, negText, posCol, negCol, prioBase) => {
            const ranked = vals
              .map((v, idx) => ({ idx, abs: Math.abs(Number(v) || 0), y: Number(v) || 0, k: numStrikes[idx] }))
              .filter((item) => item.abs > 0.01)
              .sort((a, b) => b.abs - a.abs);
            const picked = [
              ...ranked.filter((item) => item.y > 0).slice(0, 2),
              ...ranked.filter((item) => item.y < 0).slice(0, 2),
            ];
            picked.forEach((item, rIdx) => {
              candidates.push({
                k: item.k,
                y: item.y,
                nx: (item.k - xMinW) / xSpanW,
                text: item.y >= 0 ? posText : negText,
                color: item.y >= 0 ? posCol : negCol,
                score: prioBase + (item.abs / Math.max(1e-6, ySpanWf)) - rIdx * 0.08,
              });
            });
          };
          pushTopBars(cSeries, '▲ MM BUY (Chm)', '▼ MM SELL (Chm)', '#d8b4fe', '#fb7185', 2.0);
          pushTopBars(gSeries, '🟢 PIN (GEX)', '🔴 CHASE (GEX)', '#00E676', '#f43f5e', 1.5);
          pushTopBars(vSeries, '▲ IV↓ BUY (Van)', '▼ IV↓ SELL (Van)', '#22d3ee', '#fb7185', 1.0);

          candidates.sort((a, b) => b.score - a.score);
          const placedBarLabels = [];
          const barLabelSepX = isNarrow ? 0.16 : 0.125;
          candidates.forEach((cand) => {
            if (placedBarLabels.length >= 6) return;
            const collides = placedBarLabels.some((p) => (
              Math.abs(p.nx - cand.nx) < barLabelSepX && ((p.y >= 0) === (cand.y >= 0))
            ));
            if (collides) return;
            placedBarLabels.push(cand);
            annotations.push({
              xref: 'x',
              yref: 'y',
              x: cand.k,
              y: cand.y,
              xanchor: cand.nx < 0.08 ? 'left' : (cand.nx > 0.92 ? 'right' : 'center'),
              text: `<b>${cand.text}</b>`,
              showarrow: true,
              arrowhead: 0,
              arrowwidth: 1.2,
              arrowcolor: cand.color,
              ax: 0,
              ay: cand.y >= 0 ? -16 : 16,
              font: { color: cand.color, size: isNarrow ? 8 : 8.8, family: 'JetBrains Mono, monospace' },
              bgcolor: 'rgba(6, 9, 16, 0.92)',
              bordercolor: cand.color,
              borderwidth: 1,
              borderpad: 2.2,
            });
          });
        }

        let maxWfSlot = 0;
        if (showLevels && numStrikes.length) {
          const placed = [];
          const minSepW = isNarrow ? 0.17 : 0.13;
          const addWLine = (xVal, label, bg) => {
            if (!xVal || xVal < xMinW || xVal > xMaxW) return;
            shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: xVal, x1: xVal, y0: 0, y1: 1, line: { color: bg, width: 1.7, dash: 'dash' } });
            const nx = (xVal - xMinW) / xSpanW;
            let slot = 0;
            while (placed.some((p) => p.slot === slot && Math.abs(p.nx - nx) < minSepW) && slot < 4) {
              slot += 1;
            }
            if (slot > maxWfSlot) maxWfSlot = slot;
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
              font: { color: isDarkText(bg) ? '#040812' : '#ffffff', size: isNarrow ? 8.2 : 9, family: 'JetBrains Mono, monospace' },
              bgcolor: bg,
              borderpad: 2.5,
            });
          };
          addWLine(spotVal, `SPOT $${spotVal.toFixed(1)}`, '#ffffff');
          if (scopeData?.primary_magnet) addWLine(scopeData.primary_magnet, `MAGNET $${Number(scopeData.primary_magnet).toFixed(0)}`, '#f59e0b');
          if (scopeData?.lis_price) addWLine(scopeData.lis_price, `LIS $${Number(scopeData.lis_price).toFixed(1)}`, '#00F0FF');
          if (scopeData?.call_wall) addWLine(scopeData.call_wall, `CW $${Number(scopeData.call_wall).toFixed(0)}`, '#00E676');
          if (scopeData?.put_wall) addWLine(scopeData.put_wall, `PW $${Number(scopeData.put_wall).toFixed(0)}`, '#ff3366');
        }

        const wfTopMargin = maxWfSlot >= 3 ? 114 : (maxWfSlot >= 2 ? 96 : 82);
        const wfLegendY = maxWfSlot >= 3 ? 1.32 : (maxWfSlot >= 2 ? 1.24 : 1.18);

        const layout = {
          paper_bgcolor: '#060910',
          plot_bgcolor: '#070b14',
          height: plotHeightPx,
          barmode: 'group',
          margin: { l: 64, r: 62, t: wfTopMargin, b: 48 },
          shapes,
          annotations,
          showlegend: true,
          legend: {
            orientation: 'h',
            x: 0,
            y: wfLegendY,
            yanchor: 'bottom',
            font: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 9 : 10 },
            bgcolor: 'rgba(6,9,16,0.75)',
          },
          xaxis: {
            title: { text: `Strike Price ($ · ${sStrikes.length} Strikes · ${source === 'vol' ? 'Active Volume' : 'Open Interest'} · Above $0 = MM Buy)`, font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 9.8 } },
            tickprefix: '$',
            tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 9.5 },
            gridcolor: 'rgba(255,255,255,0.05)',
          },
          yaxis: {
            title: { text: waterfallNorm ? 'Normalized Relative Greek (%)' : 'Dealer Hedge Flow ($M)', font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 10 }, standoff: 6 },
            range: [yLoWf, yHiWf],
            ticksuffix: waterfallNorm ? '%' : 'M',
            tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 9.5 },
            gridcolor: 'rgba(255,255,255,0.06)',
            zeroline: true,
            zerolinecolor: '#64748b',
          },
          yaxis2: {
            title: { text: 'Pin Gravity (%)', font: { color: '#fbbf24', family: 'JetBrains Mono, monospace', size: 10 } },
            overlaying: 'y',
            side: 'right',
            range: [0, 105],
            ticksuffix: '%',
            tickfont: { color: '#fbbf24', family: 'JetBrains Mono, monospace', size: 9.5 },
            showgrid: false,
          },
        };

        window.Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: false });
        return undefined;
      }

      // =========================================================================
      // VIEW 3: DEALER O'CLOCK SESSION BREAKDOWN (30M IMPULSE + CUMULATIVE + BS VANNA)
      // =========================================================================
      const series = clockTelemetry.series || [];
      const xTime = series.map((sl) => sl.t);
      const isImpulse = clockMode === 'impulse';
      const effScen = clockTelemetry.effScenario || 'flat';
      const cursorT = clockTelemetry.cursorTime || '10:00';
      const traces = [];

      if (lens === 'vanna') {
        const yCrush = series.map((sl) => (isImpulse ? sl.stepVannaCrush : sl.cumVannaCrush));
        const ySpike = series.map((sl) => (isImpulse ? sl.stepVannaSpike : sl.cumVannaSpike));
        traces.push({
          type: 'bar',
          name: isImpulse ? 'Vanna −2% IV (30m $M)' : 'Vanna −2% IV Crush ($M)',
          x: xTime,
          y: yCrush,
          marker: { color: '#10b981', opacity: 0.88 },
          hovertemplate: `−2% IV Crush: <b>%{y:+.2f}M</b><extra></extra>`,
        });
        traces.push({
          type: 'bar',
          name: isImpulse ? 'Vanna +2% IV (30m $M)' : 'Vanna +2% IV Spike ($M)',
          x: xTime,
          y: ySpike,
          marker: { color: '#f43f5e', opacity: 0.88 },
          hovertemplate: `+2% IV Spike: <b>%{y:+.2f}M</b><extra></extra>`,
        });
        traces.push({
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Pure Charm Net ($M)',
          x: xTime,
          y: series.map((sl) => sl.cumCharm),
          yaxis: isImpulse ? 'y2' : 'y',
          line: { color: '#fbbf24', width: 2.6, dash: 'dot' },
          marker: { size: 5, color: '#fbbf24' },
          hovertemplate: `Cum Charm: <b>%{y:+.2f}M</b><extra></extra>`,
        });
      } else {
        if (showClockSplit) {
          traces.push({
            type: 'bar',
            name: isImpulse ? '0DTE/Front (30m $M)' : '0DTE/Front Charm ($M)',
            x: xTime,
            y: series.map((sl) => (isImpulse ? sl.stepFront : sl.cumFront)),
            marker: { color: '#a855f7', opacity: 0.92 },
            hovertemplate: `${isImpulse ? '0DTE 30m' : '0DTE Cum'}: <b>%{y:+.2f}M</b><extra></extra>`,
          });
          traces.push({
            type: 'bar',
            name: isImpulse ? 'Multi-DTE (30m $M)' : 'Multi-DTE Charm ($M)',
            x: xTime,
            y: series.map((sl) => (isImpulse ? sl.stepMulti : sl.cumMulti)),
            marker: { color: '#3b82f6', opacity: 0.88 },
            hovertemplate: `${isImpulse ? 'Multi 30m' : 'Multi Cum'}: <b>%{y:+.2f}M</b><extra></extra>`,
          });
        } else {
          traces.push({
            type: 'bar',
            name: isImpulse ? 'Charm Pulse (30m $M)' : 'Total Charm ($M)',
            x: xTime,
            y: series.map((sl) => (isImpulse ? sl.stepCharm : sl.cumCharm)),
            marker: { color: '#3b82f6', opacity: 0.9 },
            hovertemplate: `${isImpulse ? 'Charm 30m' : 'Charm Cum'}: <b>%{y:+.2f}M</b><extra></extra>`,
          });
        }

        if (effScen !== 'flat' && lens !== 'charm') {
          const vVals = series.map((sl) => (isImpulse ? sl.stepVanna : sl.cumVanna));
          const vColors = vVals.map((v) => (v >= 0 ? '#10b981' : '#f43f5e'));
          const scenLbl = effScen === 'crush_2' ? '−2% IV' : '+2% IV';
          traces.push({
            type: 'bar',
            name: isImpulse ? `Vanna ${scenLbl} (30m $M)` : `Vanna ${scenLbl} ($M)`,
            x: xTime,
            y: vVals,
            marker: { color: vColors, opacity: 0.85 },
            hovertemplate: `Vanna (${scenLbl}): <b>%{y:+.2f}M</b><extra></extra>`,
          });
        }

        traces.push({
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Cumulative Net Flow ($M)',
          x: xTime,
          y: series.map((sl) => sl.cumNet),
          yaxis: isImpulse ? 'y2' : 'y',
          line: { color: '#fbbf24', width: 3 },
          marker: { size: 6, color: '#fbbf24', line: { color: '#060910', width: 1.2 } },
          hovertemplate: `Cum Net Flow: <b>%{y:+.2f}M</b><extra></extra>`,
        });
      }

      const layout = {
        paper_bgcolor: '#060910',
        plot_bgcolor: '#070b14',
        height: plotHeightPx,
        barmode: 'relative',
        hovermode: 'x unified',
        hoverlabel: {
          bgcolor: 'rgba(10, 14, 23, 0.96)',
          bordercolor: 'rgba(56, 189, 248, 0.45)',
          font: { family: 'JetBrains Mono, monospace', size: 10.5, color: '#f8fafc' },
        },
        margin: { l: 64, r: isImpulse ? 64 : 32, t: 68, b: 48 },
        shapes: [
          {
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: '13:30',
            x1: '15:30',
            y0: 0,
            y1: 1,
            fillcolor: 'rgba(251, 191, 36, 0.08)',
            line: { color: 'rgba(251, 191, 36, 0.45)', width: 1.5, dash: 'dot' },
          },
          {
            type: 'line',
            xref: 'x',
            yref: 'paper',
            x0: cursorT,
            x1: cursorT,
            y0: 0,
            y1: 1,
            line: { color: '#00F0FF', width: 2, dash: 'dash' },
          },
        ],
        annotations: [
          {
            xref: 'x',
            yref: 'paper',
            x: '14:30',
            y: 1.015,
            text: '<b>⏰ DEALER O\'CLOCK (13:30–15:30)</b>',
            showarrow: false,
            yanchor: 'bottom',
            font: { color: '#fbbf24', size: 9.5, family: 'JetBrains Mono, monospace' },
            bgcolor: 'rgba(10, 14, 23, 0.92)',
            bordercolor: 'rgba(251, 191, 36, 0.35)',
            borderwidth: 1,
            borderpad: 3,
          },
          {
            xref: 'x',
            yref: 'paper',
            x: cursorT,
            y: 0.97,
            text: `<b>${cursorT} ET</b>`,
            showarrow: false,
            yanchor: 'top',
            xanchor: series.findIndex((s) => s.t === cursorT) >= 11 ? 'right' : 'left',
            xshift: series.findIndex((s) => s.t === cursorT) >= 11 ? -4 : 4,
            font: { color: '#040812', size: 9, family: 'JetBrains Mono, monospace' },
            bgcolor: '#00F0FF',
            borderpad: 2.5,
          },
        ],
        showlegend: true,
        legend: {
          orientation: 'h',
          x: 0,
          y: 1.15,
          font: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 9 : 10 },
          bgcolor: 'rgba(6,9,16,0.75)',
        },
        xaxis: {
          title: { text: `Intraday Session ET (${scopeData?.expiry_label} · ${clockTelemetry.sourceLabel})`, font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 9.5 } },
          tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 8.8 : 9.8 },
          gridcolor: 'rgba(255,255,255,0.05)',
        },
        yaxis: {
          title: { text: isImpulse ? '30m Flow Pulse ($M/30m)' : 'Cumulative Dealer Drift ($M)', font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 9.5 } },
          ticksuffix: 'M',
          tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 9.5 },
          gridcolor: 'rgba(255,255,255,0.06)',
          zeroline: true,
          zerolinecolor: '#64748b',
        },
        ...(isImpulse ? {
          yaxis2: {
            title: { text: 'Cumulative Session ($M)', font: { color: '#fbbf24', family: 'JetBrains Mono, monospace', size: 9.5 } },
            overlaying: 'y',
            side: 'right',
            ticksuffix: 'M',
            tickfont: { color: '#fbbf24', family: 'JetBrains Mono, monospace', size: 9.5 },
            showgrid: false,
            zeroline: false,
          },
        } : {}),
      };

      window.Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: false });
    } catch (err) {
      console.warn('Volland Studio Plotly error:', err);
    }

    return undefined;
  }, [
    plotlyReady,
    plotWidth,
    plotHeightPx,
    volland,
    spotVal,
    viewMode,
    lens,
    scope,
    source,
    smoothMode,
    showSignals,
    showLevels,
    showRhoPath,
    waterfallNorm,
    showWfLabels,
    showClockSplit,
    clockMode,
    clockIvScenario,
    clockTelemetry,
    timeHorizon,
    yBounds,
    scopeData,
    pvh,
    adjustedNetGrid,
    activeTimeShiftVec,
    visibleStrikes,
    expectedMove,
    totals,
    lensInfo,
  ]);

  if (!volland) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontFamily: 'monospace' }}>
        Initializing Volland Flow Studio v3.0...
      </div>
    );
  }

  const scopeTag = scope === 'all' ? 'All Chain' : (scope === 'weekly' ? '≤7D' : '0DTE');
  const lisVal = scopeData?.lis_price;
  const lisDistPct = lisVal && spotVal ? (((spotVal - lisVal) / spotVal) * 100).toFixed(1) : null;
  const rhoVal = Number(pvh?.spot_vol_corr ?? totals?.spot_vol_corr ?? -0.55).toFixed(2);
  const atmIvPct = Math.round(pvh?.atm_iv_pct ?? expectedMove?.atm_iv_pct ?? 25);
  const hLabelObj = TIME_HORIZONS[timeHorizon] || TIME_HORIZONS[0];

  return (
    <div className="sg-trace-shell">
      {/* ================================================================= */}
      {/* STRICT 2-ROW COMPACT COMMAND BAR                                  */}
      {/* ================================================================= */}
      <div className="sg-trace-cmdbar">
        <div className="sg-trace-cmd-row">
          <div className="sg-trace-pill-group">
            <button type="button" onClick={() => setViewMode('studio')} className={`sg-trace-btn ${viewMode === 'studio' ? 'active cyan' : ''}`}>
              <Compass size={11} /> Studio
            </button>
            <button type="button" onClick={() => setViewMode('waterfall')} className={`sg-trace-btn ${viewMode === 'waterfall' ? 'active cyan' : ''}`}>
              <BarChart2 size={11} /> Waterfall
            </button>
            <button type="button" onClick={() => setViewMode('clock')} className={`sg-trace-btn ${viewMode === 'clock' ? 'active cyan' : ''}`}>
              <Clock size={11} /> Clock
            </button>
          </div>

          <div className="sg-trace-pill-group">
            {Object.entries(LENS_CFG).map(([k, cfg]) => (
              <button
                key={k}
                type="button"
                onClick={() => setLens(k)}
                className={`sg-trace-btn ${lens === k ? `active lens-${k === 'net_flow' ? 'gex' : (k === 'vanna' ? 'vex' : (k === 'charm' ? 'cex' : 'gex'))}` : ''}`}
              >
                {cfg.short}
              </button>
            ))}
          </div>

          <div className="sg-trace-pill-group">
            <button type="button" onClick={() => setScope('all')} className={`sg-trace-btn ${scope === 'all' ? 'active' : ''}`}>All</button>
            <button type="button" onClick={() => setScope('weekly')} className={`sg-trace-btn ${scope === 'weekly' ? 'active' : ''}`}>≤7D</button>
            <button type="button" onClick={() => setScope('front')} className={`sg-trace-btn ${scope === 'front' ? 'active' : ''}`}>0DTE</button>
          </div>

          <div className="sg-trace-pill-group">
            <button type="button" onClick={() => setSource('oi')} className={`sg-trace-btn ${source === 'oi' ? 'active emerald' : ''}`} title="Open Interest Structural Book">🏛️ OI</button>
            <button type="button" onClick={() => setSource('vol')} className={`sg-trace-btn ${source === 'vol' ? 'active emerald' : ''}`} title="Today's Active Volume Flow">⚡ Vol</button>
          </div>

          <div className="sg-trace-pill-group" style={{ marginLeft: 'auto' }}>
            <button type="button" onClick={handleExportPng} className="sg-trace-btn compact" title="Export PNG">
              <Camera size={11} /> PNG
            </button>
            <button type="button" onClick={() => setShowGuide((v) => !v)} className={`sg-trace-btn compact ${showGuide ? 'active cyan' : ''}`}>
              <Info size={11} /> Guide {showGuide ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          </div>
        </div>

        {/* Row 2 */}
        <div className="sg-trace-cmd-row secondary">
          {viewMode !== 'clock' && (
            <div className="sg-trace-pill-group">
              {[
                { id: 'smart', lbl: 'Smart' },
                { id: '5', lbl: '±5%' },
                { id: '8', lbl: '±8%' },
                { id: '10', lbl: '±10%' },
              ].map((z) => (
                <button key={z.id} type="button" onClick={() => setZoomMode(z.id)} className={`sg-trace-btn compact ${zoomMode === z.id ? 'active' : ''}`}>
                  {z.lbl}
                </button>
              ))}
            </div>
          )}

          {viewMode === 'studio' && (
            <div className="sg-trace-pill-group">
              <button type="button" onClick={() => setSmoothMode(smoothMode === 'smooth' ? 'discrete' : 'smooth')} className={`sg-trace-btn compact ${smoothMode === 'smooth' ? 'active' : ''}`}>
                {smoothMode === 'smooth' ? 'Fluid' : 'Grid'}
              </button>
              <button type="button" onClick={() => setShowSignals((v) => !v)} className={`sg-trace-btn compact ${showSignals ? 'active emerald' : ''}`}>🎯 Sig</button>
              <button type="button" onClick={() => setShowLevels((v) => !v)} className={`sg-trace-btn compact ${showLevels ? 'active' : ''}`}>📏 Levels</button>
              <button type="button" onClick={() => setShowRhoPath((v) => !v)} className={`sg-trace-btn compact ${showRhoPath ? 'active cyan' : ''}`}>ρ Path</button>
            </div>
          )}

          {viewMode === 'waterfall' && (
            <div className="sg-trace-pill-group">
              <button type="button" onClick={() => setWaterfallNorm(true)} className={`sg-trace-btn compact ${waterfallNorm ? 'active cyan' : ''}`}>⚖️ Norm %</button>
              <button type="button" onClick={() => setWaterfallNorm(false)} className={`sg-trace-btn compact ${!waterfallNorm ? 'active emerald' : ''}`}>💵 Raw $M</button>
              <button
                type="button"
                data-testid="vl-wf-labels-toggle"
                onClick={() => setShowWfLabels((v) => !v)}
                className={`sg-trace-btn compact ${showWfLabels ? 'active purple' : ''}`}
                title="Show Market Maker BUY / SELL labels directly on the strongest strike bars"
              >
                🏷️ MM Labels
              </button>
              <button type="button" onClick={() => setShowLevels((v) => !v)} className={`sg-trace-btn compact ${showLevels ? 'active' : ''}`}>📏 Levels</button>
            </div>
          )}

          {viewMode === 'clock' && (
            <>
              <div className="sg-trace-pill-group">
                <button
                  type="button"
                  data-testid="vl-clock-mode-toggle"
                  onClick={() => setClockMode(clockMode === 'impulse' ? 'cumulative' : 'impulse')}
                  className={`sg-trace-btn compact ${clockMode === 'impulse' ? 'active cyan' : 'active emerald'}`}
                  title="Switch between Incremental 30m Velocity + Cumulative Line vs Cumulative Stacked Bars"
                >
                  {clockMode === 'impulse' ? '📊 30m Pulse + Cum' : '📈 Cumulative Stacked'}
                </button>
                <button
                  type="button"
                  data-testid="vl-clock-split-toggle"
                  onClick={() => setShowClockSplit((v) => !v)}
                  className={`sg-trace-btn compact ${showClockSplit ? 'active cyan' : ''}`}
                >
                  <Layers size={10} /> {showClockSplit ? '0DTE vs Multi' : 'Merged Charm'}
                </button>
              </div>

              <div className="sg-trace-pill-group" title="Select exact Black-Scholes IV path overlaid on Charm decay">
                <button
                  type="button"
                  data-testid="vl-clock-iv-flat"
                  onClick={() => setClockIvScenario('flat')}
                  className={`sg-trace-btn compact ${clockTelemetry.effScenario === 'flat' ? 'active cyan' : ''}`}
                >
                  0% IV (Charm)
                </button>
                <button
                  type="button"
                  data-testid="vl-clock-iv-crush"
                  onClick={() => setClockIvScenario('crush_2')}
                  className={`sg-trace-btn compact ${clockTelemetry.effScenario === 'crush_2' ? 'active emerald' : ''}`}
                >
                  −2% IV Crush
                </button>
                <button
                  type="button"
                  data-testid="vl-clock-iv-spike"
                  onClick={() => setClockIvScenario('spike_2')}
                  className={`sg-trace-btn compact ${clockTelemetry.effScenario === 'spike_2' ? 'active' : ''}`}
                >
                  +2% IV Spike
                </button>
              </div>
            </>
          )}

          {/* Interactive Dealer O'Clock Time-Decay Scrubber */}
          <div className="sg-trace-slider-wrap" style={{ marginLeft: 'auto' }} title="Simulate Black-Scholes Charm Time Decay into Dealer O'Clock & MOC">
            <span className="sg-trace-group-lbl">TIME</span>
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              value={timeHorizon}
              onChange={(e) => setTimeHorizon(Number(e.target.value))}
              className="sg-trace-slider"
              aria-label="Dealer O'Clock Time Decay Scrubber"
            />
            <span className={`sg-trace-iv-badge ${timeHorizon > 0 ? 'crush' : 'live'}`}>
              {hLabelObj.short}
            </span>
            {timeHorizon !== 0 && (
              <button type="button" onClick={() => setTimeHorizon(0)} className="sg-trace-reset-btn" title="Reset Time Horizon to Live">
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
        <div className="sg-tel-tile" style={{ borderLeft: `3px solid ${scopeData?.paradigm_color || '#c084fc'}` }}>
          <span className="sg-tel-lbl">PARADIGM · {scopeTag}</span>
          <strong className="sg-tel-val" style={{ color: scopeData?.paradigm_color || '#c084fc' }}>
            {scopeData?.paradigm_short || 'VOL-TRAP'}
          </strong>
          <span className="sg-tel-sub">
            IV {atmIvPct}% · ρ {rhoVal}
          </span>
        </div>

        <div className="sg-tel-tile" style={{ borderLeft: '3px solid #00F0FF' }}>
          <span className="sg-tel-lbl">LINE IN SAND (LIS)</span>
          <strong className="sg-tel-val" style={{ color: '#00F0FF' }}>
            {lisVal ? `$${Number(lisVal).toFixed(2)}` : 'No Flip ±22%'}
          </strong>
          <span className="sg-tel-sub">
            {lisDistPct !== null
              ? `${Number(lisDistPct) >= 0 ? '▲ +' : '▼ '}${lisDistPct}% vs LIS`
              : (scopeData?.lis_note || 'Uniform Gamma')}
          </span>
        </div>

        <div className="sg-tel-tile" style={{ borderLeft: '3px solid #f59e0b' }}>
          <span className="sg-tel-lbl">PRIMARY MAGNET</span>
          <strong className="sg-tel-val" style={{ color: '#f59e0b' }}>
            ${scopeData?.primary_magnet || '--'} · {scopeData?.pin_probability_pct || 50}% Pin
          </strong>
          <span className="sg-tel-sub">
            Air Pocket: ${scopeData?.acceleration_void || '--'}
          </span>
        </div>

        <div className="sg-tel-tile">
          <span className="sg-tel-lbl">TRUE CORRIDOR</span>
          <strong className="sg-tel-val">
            <span style={{ color: '#00E676' }}>↑${scopeData?.upper_resistance || '--'}</span>
            <span style={{ color: '#475569', margin: '0 4px' }}>/</span>
            <span style={{ color: '#ff3366' }}>↓${scopeData?.lower_support || '--'}</span>
          </strong>
          <span className="sg-tel-sub">
            Spot ${spotVal.toFixed(2)} ({yBounds[0].toFixed(0)}–{yBounds[1].toFixed(0)})
          </span>
        </div>

        <div className="sg-tel-tile">
          <span className="sg-tel-lbl">VANNA / 1% IV</span>
          <strong className="sg-tel-val" style={{ color: (scopeData?.vanna_1vol_m || 0) >= 0 ? '#22d3ee' : '#fb7185' }}>
            {fmtM(scopeData?.vanna_1vol_m || 0)}
          </strong>
          <span className="sg-tel-sub">
            {(scopeData?.vanna_1vol_m || 0) >= 0 ? 'IV↓ Buy Tailwind' : 'IV↑ Sell Overhead'}
          </span>
        </div>

        <div className="sg-tel-tile">
          <span className="sg-tel-lbl">CHARM · O&apos;CLOCK</span>
          <strong className="sg-tel-val" style={{ color: (scopeData?.charm_daily_m || 0) >= 0 ? '#c084fc' : '#f43f5e' }}>
            {fmtM(scopeData?.charm_daily_m || 0)}/d
          </strong>
          <span className="sg-tel-sub">
            13:30–15:30: {fmtM(scopeData?.dealer_oclock_charm_m || 0)}
          </span>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SYNCHRONIZED PLOTLY CANVAS                                        */}
      {/* ================================================================= */}
      <div className="sg-trace-canvas-wrap">
        {!plotlyReady && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontFamily: 'monospace' }}>
            Loading Volland Flow Studio v3.0 Plotly engine...
          </div>
        )}
        <div
          ref={plotRef}
          style={{ width: '100%', height: `${plotHeightPx}px`, borderRadius: '10px', overflow: 'hidden' }}
        />
        {viewMode === 'clock' ? (
          <div className="sg-trace-micro-legend" data-testid="vl-clock-micro-legend">
            <span><b style={{ color: '#a855f7' }}>VIOLET</b> 0DTE/Front Charm</span>
            <span><b style={{ color: '#3b82f6' }}>BLUE</b> Multi-DTE Charm</span>
            <span><b style={{ color: '#10b981' }}>GREEN</b>/<b style={{ color: '#f43f5e' }}>ROSE</b> BS Vanna ({clockTelemetry.effScenario === 'flat' ? '0% Off' : (clockTelemetry.effScenario === 'crush_2' ? '−2% IV' : '+2% IV')})</span>
            <span><b style={{ color: '#fbbf24' }}>GOLD LINE</b> Cum Net</span>
            <span><b style={{ color: '#00F0FF' }}>CYAN CURSOR</b> {clockTelemetry.cursorTime} ET</span>
          </div>
        ) : viewMode === 'waterfall' ? (
          <div className="sg-trace-micro-legend" data-testid="vl-wf-micro-legend">
            <span><b style={{ color: '#00E676' }}>ABOVE $0</b> ▲ MM MUST BUY / PIN</span>
            <span><b style={{ color: '#f43f5e' }}>BELOW $0</b> ▼ MM MUST SELL / CHASE</span>
            <span><b style={{ color: '#c084fc' }}>PURPLE</b> Charm (Time Decay)</span>
            <span><b style={{ color: '#22d3ee' }}>CYAN</b> Vanna (IV↓)</span>
            <span><b style={{ color: '#00E676' }}>GREEN</b> Gamma</span>
            <span><b style={{ color: '#fbbf24' }}>GOLD</b> Pin Gravity %</span>
          </div>
        ) : (
          <div className="sg-trace-micro-legend">
            <span><b style={{ color: '#00E676' }}>EMERALD</b> Buy/Support</span>
            <span><b style={{ color: '#ff3366' }}>CRIMSON</b> Sell/Supply</span>
            <span><b style={{ color: '#fbbf24' }}>GOLD</b> $0 Eq &amp; Pin</span>
            <span><b style={{ color: '#00F0FF' }}>CYAN</b> ρ Path ({rhoVal})</span>
            <span><b style={{ color: '#c084fc' }}>CLOCK</b> Charm+Vanna</span>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* WATERFALL MARKET MAKER ACTION GUIDE (3-CARD STRIP)                */}
      {/* ================================================================= */}
      {viewMode === 'waterfall' && (
        <div className="vl-wf-action-strip" data-testid="vl-wf-action-strip">
          <div className="vl-wf-card charm" data-testid="vl-wf-card-charm">
            <div className="vl-wf-card-top">
              <span className="vl-wf-card-title" style={{ color: '#d8b4fe' }}>Charm · Time Decay</span>
              <span className={`vl-q-badge ${waterfallPeaks.charm.val >= 0 ? 'buy' : 'sell'}`}>
                Peak ${waterfallPeaks.charm.strike} ({fmtM(waterfallPeaks.charm.val)}/d · {waterfallPeaks.charm.val >= 0 ? 'MM BUY' : 'MM SELL'})
              </span>
            </div>
            <div className="vl-wf-rules">
              <div className="vl-wf-rule">
                <b style={{ color: '#00E676' }}>+ve Bar:</b> Market Makers <strong>MUST BUY</strong> shares as time decays toward close (dip bid).
              </div>
              <div className="vl-wf-rule">
                <b style={{ color: '#ff3366' }}>−ve Bar:</b> Market Makers <strong>MUST SELL</strong> shares as time decays (overhead drag).
              </div>
            </div>
          </div>

          <div className="vl-wf-card vanna" data-testid="vl-wf-card-vanna">
            <div className="vl-wf-card-top">
              <span className="vl-wf-card-title" style={{ color: '#22d3ee' }}>Vanna · IV Shift</span>
              <span className={`vl-q-badge ${waterfallPeaks.vanna.val >= 0 ? 'buy' : 'sell'}`}>
                Peak ${waterfallPeaks.vanna.strike} ({fmtM(waterfallPeaks.vanna.val)} · {waterfallPeaks.vanna.val >= 0 ? 'IV↓ BUY' : 'IV↓ SELL'})
              </span>
            </div>
            <div className="vl-wf-rules">
              <div className="vl-wf-rule">
                <b style={{ color: '#00E676' }}>+ve Bar:</b> <strong>MM BUY</strong> on IV crush (<strong>MM SELL</strong> if IV spikes).
              </div>
              <div className="vl-wf-rule">
                <b style={{ color: '#ff3366' }}>−ve Bar:</b> <strong>MM SELL</strong> on IV crush (<strong>MM BUY</strong> if IV spikes).
              </div>
            </div>
          </div>

          <div className="vl-wf-card gamma" data-testid="vl-wf-card-gamma">
            <div className="vl-wf-card-top">
              <span className="vl-wf-card-title" style={{ color: '#00E676' }}>Gamma · Spot Hedge</span>
              <span className={`vl-q-badge ${waterfallPeaks.gamma.val >= 0 ? 'buy' : 'sell'}`}>
                Peak ${waterfallPeaks.gamma.strike} ({fmtM(waterfallPeaks.gamma.val)} · {waterfallPeaks.gamma.val >= 0 ? 'PIN' : 'CHASE'})
              </span>
            </div>
            <div className="vl-wf-rules">
              <div className="vl-wf-rule">
                <b style={{ color: '#00E676' }}>+ve Bar:</b> <strong>MM BUY dips</strong> &amp; <strong>SELL rallies</strong> (range-bound pinning).
              </div>
              <div className="vl-wf-rule">
                <b style={{ color: '#ff3366' }}>−ve Bar:</b> <strong>MM SELL dips</strong> &amp; <strong>BUY breakouts</strong> (trend acceleration).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* DEALER CLOCK SESSION BRIEF + 4-PHASE SESSION BREAKDOWN            */}
      {/* ================================================================= */}
      {viewMode === 'clock' && (
        <div className="vl-clock-deck" data-testid="vl-clock-deck">
          <div className="vl-clock-brief" data-testid="vl-clock-brief">
            <div className="vl-clock-brief-pills">
              <span className="vl-clk-pill src">{clockTelemetry.sourceLabel}</span>
              <span className="vl-clk-pill">
                Cursor <b>{clockTelemetry.cursorTime} ET</b> · Elapsed <b>{fmtM(clockTelemetry.elapsedM)}</b> / Remaining <b style={{ color: clockTelemetry.remainingM >= 0 ? '#00E676' : '#ff3366' }}>{fmtM(clockTelemetry.remainingM)}</b>
              </span>
              <span className="vl-clk-pill peak">
                Peak 30m: <b>{clockTelemetry.peakWin.window} ({fmtM(clockTelemetry.peakWin.step_charm_m)})</b> · {clockTelemetry.peakWin.share_pct}%
              </span>
              <span className="vl-clk-pill oclock">
                O&apos;Clock Share: <b>{clockTelemetry.oclockSharePct}%</b> · 0DTE Mix: <b>{clockTelemetry.frontSharePct}%</b>
              </span>
            </div>
            <div className="vl-clock-directive">
              <strong>Clock Read:</strong> {clockTelemetry.effText}
            </div>
          </div>

          <div className="vl-clock-phases" data-testid="vl-clock-phases">
            {clockTelemetry.phaseCards.map((ph) => (
              <div
                key={ph.id}
                data-testid={`vl-phase-${ph.id}`}
                className={`vl-phase-card ${ph.isPos ? 'buy' : 'sell'} ${ph.is_oclock ? 'is-oclock' : ''}`}
              >
                <div className="vl-q-top">
                  <span className="vl-q-title">{ph.window} · {ph.label}</span>
                  <span className={`vl-q-badge ${ph.isPos ? 'buy' : 'sell'}`}>
                    {ph.isPos ? '▲ BUY' : '▼ SELL'} · {ph.share_pct}%
                  </span>
                </div>
                <div className="vl-q-val-row">
                  <div className="vl-q-val" style={{ color: ph.isPos ? '#00E676' : '#ff3366' }}>
                    {fmtM(ph.netVal)}
                  </div>
                  <div className="vl-q-drivers">
                    <span>Chm <b>{fmtM(ph.charmVal)}</b></span>
                    {Math.abs(ph.vannaVal) >= 0.01 && <span>Van <b>{fmtM(ph.vannaVal)}</b></span>}
                    <span>0DTE <b>{ph.frontSharePct}%</b></span>
                  </div>
                </div>
                <div className="vl-q-reason">
                  <strong>Why:</strong> {ph.readText}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SINGLE-ROW 4-COLUMN QUADRANT STRESS DECK + DRIVER REASONING       */}
      {/* ================================================================= */}
      <div className="vl-quadrant-grid" data-testid="vl-quadrant-grid">
        {scenarioCards.map((sc) => (
          <div key={sc.id} className={`vl-q-card ${sc.isPositive ? 'buy' : 'sell'}`} data-testid={`vl-q-card-${sc.id}`}>
            <div className="vl-q-top">
              <span className="vl-q-title">{sc.title}</span>
              <span className={`vl-q-badge ${sc.isPositive ? 'buy' : 'sell'}`}>
                {sc.isPositive ? '▲ BUY' : '▼ SELL'}
              </span>
            </div>
            <div className="vl-q-val-row">
              <div className="vl-q-val" style={{ color: sc.isPositive ? '#00E676' : '#ff3366' }}>
                {fmtM(sc.displayValM)}{lens === 'charm' ? '/d' : (lens === 'gex' ? '/1%' : '')}
              </div>
              <span className={`vl-q-tag ${sc.isPositive ? 'buy' : 'sell'}`}>{sc.behaviorTag}</span>
            </div>
            <div className="vl-q-meta">
              <span>{sc.compactSub}</span>
              <span>{sc.subMetric}</span>
            </div>
            <div className="vl-q-drivers">
              <span>Gam <b>{fmtM(sc.gammaFlowM)}</b></span>
              <span>Van <b>{fmtM(sc.vannaM)}</b></span>
              {timeHorizon > 0 && Math.abs(sc.tShift) >= 0.01 && (
                <span>Chm <b>{fmtM(sc.tShift)}</b></span>
              )}
            </div>
            <div className="vl-q-reason" data-testid={`vl-q-reason-${sc.id}`}>
              <strong>Why:</strong> {sc.reason}
            </div>
          </div>
        ))}
      </div>

      {/* ================================================================= */}
      {/* COLLAPSIBLE GUIDE (DEFAULT CLOSED, ZERO RAW LATEX)                */}
      {/* ================================================================= */}
      {showGuide && (
        <div className="gex-trace-guide-card" style={{ margin: 0 }}>
          <div className="guide-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass size={14} color="#c084fc" />
              <strong style={{ color: '#ffffff', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                Volland Flow Studio v3.0 · Institutional Vanna &amp; Charm Playbook
              </strong>
            </div>
            <span className="guide-badge-pill">EXACT BLACK-SCHOLES DEALER RE-HEDGING SURFACE</span>
          </div>
          <div className="guide-cols-3">
            <div className="guide-col">
              <strong style={{ color: '#f59e0b' }}>1. Strike Waterfall &amp; Magnets (Left)</strong>
              <p>
                Maps Gamma, Vanna, Charm, and Gold Pinning Gravity (%) onto the exact Price Y-axis of the 2D surface. Switch instantly between structural OI Walls (🏛️) and live today&apos;s contract volume (⚡).
              </p>
            </div>
            <div className="guide-col">
              <strong style={{ color: '#00F0FF' }}>2. Price × ΔIV Surface (Center)</strong>
              <p>
                Shows exact dollar stock hedging dealers must execute as both Price (±10%) and Implied Volatility (±10% pts) move. Drag the <strong>TIME</strong> scrubber to inject BS afternoon Charm decay into the surface.
              </p>
            </div>
            <div className="guide-col">
              <strong style={{ color: '#c084fc' }}>3. Dealer O&apos;Clock Timeline (Bottom)</strong>
              <p>
                Models cumulative 0DTE vs Multi-DTE Charm unwinding across 09:30–16:00 ET, highlighting the 13:30–15:30 ET Dealer O&apos;Clock window where pinning or late-day liquidation accelerates.
              </p>
            </div>
          </div>

          <div className="vl-q-guide-strip" data-testid="vl-quadrant-guide-strip">
            <div className="guide-col">
              <strong style={{ color: '#00E676' }}>Rally + Vol Crush (+3% · −4% IV)</strong>
              <p>Classic melt-up regime: tests whether Call-Wall Gamma supply is overwhelmed by Vanna IV-crush buybacks or short-gamma squeeze covering.</p>
            </div>
            <div className="guide-col">
              <strong style={{ color: '#38bdf8' }}>Rally + Vol Spike (+3% · +4% IV)</strong>
              <p>Call-chase / event FOMO rally: tests Call-Wall supply against upside Vanna expansion (plus short-gamma chasing if spot sits below LIS).</p>
            </div>
            <div className="guide-col">
              <strong style={{ color: '#fbbf24' }}>Dip + Vol Crush (−3% · −4% IV)</strong>
              <p>Controlled pullback / post-event bleed: tests Put support + Vanna buyback cushion (or negative-Vanna unwind if puts shrink fast).</p>
            </div>
            <div className="guide-col">
              <strong style={{ color: '#ff3366' }}>Selloff + Vol Spike (−3% · +4% IV)</strong>
              <p>Crash stress test: measures whether Long-Gamma dip buying can hold back Negative-Vanna put delta inflation or flips into a Short-Gamma cascade.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
