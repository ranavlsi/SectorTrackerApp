import React, { useState, useMemo, useEffect } from 'react';
import {
  Flame, TrendingUp, Target, ShieldCheck, Layers, Zap, RefreshCw,
  Search, LayoutGrid, List, Copy, Check, Info, ChevronDown, ChevronUp,
  Compass, Activity, BarChart2, Filter
} from 'lucide-react';
import CleanUptrendDashboard from './CleanUptrendDashboard';

const PILLARS = [
  { id: 'confluence', label: '🔥 Multi-Scanner Confluence', color: '#f59e0b', keys: [] },
  {
    id: 'momentum',
    label: '🚀 Momentum & Leaders',
    color: '#10b981',
    keys: [
      'clean_uptrend_9_13',
      'best_acting_stocks',
      'emerging_leaders',
      'realsimple_framework',
      'relative_strength',
      'rs_divergence',
      'deepvue_leaders',
      'fresh_52w_high',
      'all_time_high'
    ]
  },
  {
    id: 'breakouts',
    label: '📐 Bases, Breakouts & Flags',
    color: '#38bdf8',
    keys: [
      'early_stage_2',
      'darvas_about_to',
      'darvas_strong',
      'deepvue_launchpad',
      'deepvue_vcp',
      'chop_incubation_leaders',
      'pending_breakout',
      'long_base_breakout',
      'medium_base_breakout',
      'low_volume_breakout',
      'weekly_cup_handle',
      'monthly_cup_handle',
      'bull_flag_breakout',
      'bull_flag_pending',
      'qullamaggie_setup',
      'qullamaggie_parabolic',
      'universal_takeout',
      'regression_channel_breakout'
    ]
  },
  {
    id: 'pullbacks',
    label: '🎯 Pullbacks & Retests',
    color: '#a855f7',
    keys: [
      'first_ma_pullback',
      'wick_supply_absorption',
      'breakout_retest',
      'base_pullback_ma',
      'ipo_avwap'
    ]
  },
  {
    id: 'volume_smc',
    label: '🏛️ Volume Profile & SMC',
    color: '#06b6d4',
    keys: [
      'val_rejection',
      'val_rejection_fixed',
      'vah_rejection',
      'vah_rejection_fixed',
      'poc_rejection',
      'poc_rejection_fixed',
      'fvg_sma_confluence',
      'smc_divergence_reversal',
      'smc_200w_sma_reversal',
      'hve_volume',
      'hve_consolidation'
    ]
  },
  {
    id: 'catalysts',
    label: '⚡ Earnings & Catalysts',
    color: '#ec4899',
    keys: [
      'post_earning_reaction',
      'post_earning_consolidation',
      'earnings_surge',
      'zacks_rank_1'
    ]
  },
  {
    id: 'reversals',
    label: '🔄 Reversals & Candlesticks',
    color: '#fb923c',
    keys: [
      'reversal',
      'bullish_candlestick',
      'bearish_candlestick'
    ]
  }
];

const EXTRA_SCANNER_META = {
  deepvue_leaders: {
    title: 'TraderLion / DeepVue Quantitative Leaders',
    desc: 'S.N.I.P Matrix: RS Rating > 80, VCP structure, and Earnings/Revenue growth acceleration.'
  },
  deepvue_vcp: {
    title: 'DeepVue Tightly Coiled VCP Setups',
    desc: 'Mark Minervini Volatility Contraction Pattern (VCP) setups detected within DeepVue leaders.'
  }
};

/**
 * Compact 30D Price + EMA10 + EMA21 Sparkline SVG
 */
const MiniSetupSparkline = ({ sparkline, ticker = 'STK', width = 280, height = 66 }) => {
  if (!sparkline || !Array.isArray(sparkline.close) || sparkline.close.length < 5) {
    return (
      <div
        style={{
          width: '100%',
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(2, 6, 23, 0.55)',
          borderRadius: 8,
          border: '1px solid rgba(51, 65, 85, 0.4)',
          fontSize: '0.68rem',
          color: '#64748b'
        }}
      >
        30D Sparkline Pending
      </div>
    );
  }

  const closes = sparkline.close;
  const ema10 = sparkline.ema10 || [];
  const ema21 = sparkline.ema21 || [];
  const allVals = [...closes, ...ema10, ...ema21].filter((v) => Number.isFinite(v));
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const range = Math.max(0.01, maxVal - minVal);
  const padX = 5;
  const padY = 6;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toPts = (arr) =>
    arr
      .map((v, i) => {
        const x = padX + (i / Math.max(1, arr.length - 1)) * innerW;
        const y = padY + innerH - ((v - minVal) / range) * innerH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const closePts = toPts(closes);
  const e10Pts = ema10.length === closes.length ? toPts(ema10) : '';
  const e21Pts = ema21.length === closes.length ? toPts(ema21) : '';
  const isUp = closes[closes.length - 1] >= closes[0];
  const strokeColor = isUp ? '#10b981' : '#f59e0b';
  const lastX = padX + innerW;
  const lastY = padY + innerH - ((closes[closes.length - 1] - minVal) / range) * innerH;
  const gradId = `esh-g-${ticker.replace(/[^a-zA-Z0-9]/g, '')}-${isUp ? 'u' : 'f'}`;

  return (
    <div style={{ background: 'rgba(2, 6, 23, 0.65)', borderRadius: 8, border: '1px solid rgba(51,65,85,0.45)', padding: '5px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.6rem', color: '#94a3b8', marginBottom: 2 }}>
        <span style={{ fontWeight: 700, color: '#cbd5e1' }}>30D TREND + EMA 10/21</span>
        <div style={{ display: 'flex', gap: 6, fontFamily: 'monospace' }}>
          <span style={{ color: '#38bdf8' }}>― 10E</span>
          <span style={{ color: '#a855f7' }}>-- 21E</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: `${height}px`, display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polygon points={`${padX},${height - padY} ${closePts} ${padX + innerW},${height - padY}`} fill={`url(#${gradId})`} />
        {e21Pts && <polyline fill="none" stroke="#a855f7" strokeWidth="1.15" strokeDasharray="3,2" points={e21Pts} opacity="0.82" />}
        {e10Pts && <polyline fill="none" stroke="#38bdf8" strokeWidth="1.25" points={e10Pts} opacity="0.9" />}
        <polyline fill="none" stroke={strokeColor} strokeWidth="2.0" points={closePts} />
        <circle cx={lastX} cy={lastY} r="3.2" fill={strokeColor} stroke="#ffffff" strokeWidth="1.1" />
      </svg>
    </div>
  );
};

export default function ExpertScreenersHub({
  screenerData,
  cleanUptrendData,
  emergingLeadersData,
  bestActingData,
  wickAbsorptionData,
  deepvueData,
  realsimpleData,
  firstMaPullbackData,
  screenerCategories = {},
  screenerDescriptions = {},
  onTickerClick,
  onOpenFundamentals,
  onRefreshAll,
  onRefreshCleanUptrend
}) {
  const [activePillar, setActivePillar] = useState('confluence');
  const [selectedScanner, setSelectedScanner] = useState('best_acting_stocks');
  const [pillarOverviewMode, setPillarOverviewMode] = useState(false);
  const [minMcapB, setMinMcapB] = useState(2);
  const [minVolM, setMinVolM] = useState(0.5);
  const [equitiesOnly, setEquitiesOnly] = useState(true);
  const [globalSearch, setGlobalSearch] = useState('');
  const [sortBy, setSortBy] = useState('confluence');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [minConfluenceFilter, setMinConfluenceFilter] = useState(2);
  const [showMethodInfo, setShowMethodInfo] = useState(false);
  const [copiedTicker, setCopiedTicker] = useState(null);

  const telemetryMap = useMemo(() => screenerData?._ticker_telemetry || {}, [screenerData]);

  // Helper to get human-readable scanner label & description
  const getScannerMeta = (key) => {
    if (screenerCategories?.[key]) {
      return {
        title: screenerCategories[key].title || key,
        icon: screenerCategories[key].icon || <Target size={15} color="#38bdf8" />,
        desc: screenerDescriptions?.[key] || screenerCategories[key].desc || ''
      };
    }
    if (EXTRA_SCANNER_META[key]) {
      return {
        title: EXTRA_SCANNER_META[key].title,
        icon: <Zap size={15} color="#fbbf24" />,
        desc: EXTRA_SCANNER_META[key].desc
      };
    }
    return {
      title: key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      icon: <Layers size={15} color="#38bdf8" />,
      desc: ''
    };
  };

  // Build normalized scanner -> raw items map (combining screenerData + rich sibling datasets)
  const rawScannerMap = useMemo(() => {
    const map = {};
    const addRaw = (key, arr) => {
      if (Array.isArray(arr)) map[key] = arr;
    };

    if (screenerData && typeof screenerData === 'object') {
      Object.entries(screenerData).forEach(([k, v]) => {
        if (!k.startsWith('_') && Array.isArray(v)) {
          map[k] = v;
        }
      });
    }

    if (firstMaPullbackData?.results) {
      addRaw(
        'first_ma_pullback',
        firstMaPullbackData.results.map((s) => ({
          ticker: s.ticker,
          score: s.score || 82,
          close: s.close,
          metric: `$${s.close} | 1st Retest ${s.ma_tested} ($${s.ma_price}) | Impulse +${s.impulse_gain_pct}% | ${s.volume_footprint}`
        }))
      );
    }
    if (realsimpleData?.stocks) {
      addRaw(
        'realsimple_framework',
        realsimpleData.stocks.map((s) => ({
          ticker: s.ticker,
          score: s.score || 80,
          price: s.price,
          metric: `$${s.price} | ${s.setup_type || '3-Line Stack'} | RS ${s.rs_outperformance_pct > 0 ? '+' : ''}${s.rs_outperformance_pct}% | VDU ${s.vdu_ratio}x`
        }))
      );
    }
    if (bestActingData?.stocks) {
      addRaw(
        'best_acting_stocks',
        bestActingData.stocks.map((s) => ({
          ticker: s.ticker,
          score: s.score || 80,
          price: s.price,
          metric: `$${s.price} | Score ${s.score}/100 | ADX ${s.adx} | 21-EMA ${s.dist_ema21_pct > 0 ? '+' : ''}${s.dist_ema21_pct}%`
        }))
      );
    }
    if (emergingLeadersData?.candidates) {
      addRaw(
        'emerging_leaders',
        emergingLeadersData.candidates.map((c) => ({
          ticker: c.ticker,
          score: c.score || 78,
          price: c.price,
          entry_pivot: c.entry_pivot,
          stop_loss: c.stop_loss,
          risk_pct: c.risk_pct,
          metric: `${c.tier_label} (${c.score}/100) · Pivot $${c.entry_pivot} · Pinch ${c.pinch_spread_pct ?? ''}%`
        }))
      );
    }
    if (wickAbsorptionData?.results) {
      addRaw(
        'wick_supply_absorption',
        wickAbsorptionData.results.map((s) => ({
          ticker: s.ticker,
          score: s.score || 80,
          close: s.close,
          metric: `$${s.close} | ${s.tier_badge} | Wick: ${s.wick_zone} | VDU: ${s.vdu_pct}%`
        }))
      );
    }
    if (cleanUptrendData?.stocks) {
      addRaw('clean_uptrend_9_13', cleanUptrendData.stocks);
    }
    if (deepvueData?.leaders) {
      addRaw(
        'deepvue_leaders',
        deepvueData.leaders.map((d) => ({
          ticker: d.ticker,
          score: d.rs_rating || d.rs_score || 80,
          price: d.price,
          metric: `RS Rank ${d.rs_rating}${d.vcp_setup ? ' 🔥(VCP)' : ''} | EPS ${d.eps_growth_pct ?? 0}% | Rev ${d.rev_growth_pct ?? 0}%`
        }))
      );
    }
    if (deepvueData?.active_vcp) {
      addRaw(
        'deepvue_vcp',
        deepvueData.active_vcp.map((d) => ({
          ticker: d.ticker,
          score: d.rs_rating || 80,
          price: d.price,
          metric: `RS Rank ${d.rs_rating} · Tight VCP Coil`
        }))
      );
    }

    return map;
  }, [
    screenerData,
    firstMaPullbackData,
    realsimpleData,
    bestActingData,
    emergingLeadersData,
    wickAbsorptionData,
    cleanUptrendData,
    deepvueData
  ]);

  // Client-side fallback confluence index across all scanner buckets
  const clientTickerScanners = useMemo(() => {
    const idxMap = {};
    Object.entries(rawScannerMap).forEach(([k, rows]) => {
      rows.forEach((r) => {
        const sym = String(r?.ticker || '').toUpperCase().trim();
        if (!sym) return;
        if (!idxMap[sym]) idxMap[sym] = new Set();
        idxMap[sym].add(k);
      });
    });
    const out = {};
    Object.entries(idxMap).forEach(([sym, setObj]) => {
      out[sym] = Array.from(setObj).sort();
    });
    return out;
  }, [rawScannerMap]);

  // Enrich any raw row with telemetryMap + fallback confluence
  const enrichItem = (item) => {
    if (!item || !item.ticker) return null;
    const sym = String(item.ticker).toUpperCase().trim();
    const tel = telemetryMap[sym] || {};
    const scannerKeys = tel.scanner_keys || clientTickerScanners[sym] || [];
    const price = Number(item.price || item.close || tel.price || 0);
    const mcapB = Number(item.market_cap_b || tel.market_cap_b || 0);
    const volM = item.avg_vol_20_m !== undefined ? Number(item.avg_vol_20_m) : Number(tel.avg_vol_20_m || 0);
    const dvolM = item.dollar_vol_m !== undefined ? Number(item.dollar_vol_m) : Number(tel.dollar_vol_m || 0);
    const isEtf = item.is_etf !== undefined ? Boolean(item.is_etf) : Boolean(tel.is_etf);

    return {
      ...item,
      ticker: sym,
      name: (item.name && item.name.toUpperCase() !== sym ? item.name : tel.name) || sym,
      sector: item.sector || tel.sector || 'US Equity',
      price,
      change_pct: item.change_pct !== undefined ? Number(item.change_pct) : Number(tel.change_pct || 0),
      return_20d_pct: Number(tel.return_20d_pct || 0),
      market_cap_b: mcapB,
      avg_vol_20_m: volM,
      dollar_vol_m: dvolM,
      rvol_20: Number(tel.rvol_20 || item.rvol || 1.0),
      is_etf: isEtf,
      score: Number(item.score || 78),
      confluence_count: Math.max(Number(tel.confluence_count || 0), scannerKeys.length),
      scanner_keys: scannerKeys,
      sparkline: tel.sparkline || item.sparkline || null,
      trade_plan: item.trade_plan || (item.stop_loss ? {
        entry: item.entry_pivot || price,
        stop_loss: item.stop_loss,
        risk_pct: item.risk_pct || 4.0,
        target_1: Number(((item.entry_pivot || price) * 1.08).toFixed(2)),
        target_2: Number(((item.entry_pivot || price) * 1.15).toFixed(2))
      } : tel.trade_plan || null)
    };
  };

  // Global liquidity + ETF filter
  const passesGlobalGate = (enriched) => {
    if (!enriched) return false;
    if (equitiesOnly && enriched.is_etf) return false;
    if (minMcapB > 0 && enriched.market_cap_b < minMcapB) return false;
    if (minVolM > 0 && enriched.avg_vol_20_m < minVolM) return false;
    return true;
  };

  // Enriched + filtered items per scanner key
  const filteredScannerMap = useMemo(() => {
    const out = {};
    Object.entries(rawScannerMap).forEach(([key, rows]) => {
      const seen = new Set();
      const filtered = [];
      rows.forEach((raw) => {
        const en = enrichItem(raw);
        if (!en || seen.has(en.ticker)) return;
        if (!passesGlobalGate(en)) return;
        seen.add(en.ticker);
        filtered.push(en);
      });
      out[key] = filtered;
    });
    return out;
  }, [rawScannerMap, telemetryMap, clientTickerScanners, minMcapB, minVolM, equitiesOnly]);

  // Attach any unmapped ScreenerCategories keys to 'breakouts' so zero scanners are missed
  const resolvedPillars = useMemo(() => {
    const mappedSet = new Set(PILLARS.flatMap((p) => p.keys));
    const extras = Object.keys(screenerCategories || {}).filter((k) => !mappedSet.has(k));
    return PILLARS.map((p) =>
      p.id === 'breakouts' && extras.length > 0 ? { ...p, keys: [...p.keys, ...extras] } : p
    );
  }, [screenerCategories]);

  // Cross-scanner confluence rows (respecting active global filters)
  const confluenceItems = useMemo(() => {
    const list = [];
    Object.entries(clientTickerScanners).forEach(([sym, scannerKeys]) => {
      const tel = telemetryMap[sym] || {};
      const en = enrichItem({ ticker: sym, ...tel });
      if (!en || en.confluence_count < minConfluenceFilter) return;
      if (!passesGlobalGate(en)) return;
      const sample = (screenerData?._confluence_leaders || []).find((x) => x.ticker === sym);
      list.push({
        ...en,
        score: sample?.score || Math.min(98, 66 + en.confluence_count * 5),
        metric: `Confluent across ${en.confluence_count} scanners: ${en.scanner_keys
          .slice(0, 4)
          .map((k) => getScannerMeta(k).title.replace(/^[^\w]+/, '').slice(0, 26))
          .join(' • ')}`
      });
    });

    list.sort((a, b) => {
      if (sortBy === 'score') return (b.score || 0) - (a.score || 0);
      if (sortBy === 'change_1d') return (b.change_pct || 0) - (a.change_pct || 0);
      if (sortBy === 'return_20d') return (b.return_20d_pct || 0) - (a.return_20d_pct || 0);
      if (sortBy === 'avg_vol') return (b.avg_vol_20_m || 0) - (a.avg_vol_20_m || 0);
      if (sortBy === 'market_cap') return (b.market_cap_b || 0) - (a.market_cap_b || 0);
      return (b.confluence_count - a.confluence_count) || (b.score - a.score) || (b.dollar_vol_m - a.dollar_vol_m);
    });
    return list;
  }, [clientTickerScanners, telemetryMap, screenerData, minConfluenceFilter, minMcapB, minVolM, equitiesOnly, sortBy]);

  // Auto-select first populated scanner when switching pillar
  const activePillarObj = useMemo(
    () => resolvedPillars.find((p) => p.id === activePillar) || resolvedPillars[0],
    [resolvedPillars, activePillar]
  );

  useEffect(() => {
    if (activePillar === 'confluence') return;
    const keys = activePillarObj?.keys || [];
    if (!keys.includes(selectedScanner)) {
      const firstPop = keys.find((k) => (filteredScannerMap[k]?.length || 0) > 0) || keys[0];
      if (firstPop) setSelectedScanner(firstPop);
    }
    setPillarOverviewMode(false);
  }, [activePillar, activePillarObj]);

  // Global search results across all scanners
  const globalSearchMatches = useMemo(() => {
    const q = globalSearch.trim().toUpperCase();
    if (!q) return [];
    const seen = new Map();
    Object.entries(filteredScannerMap).forEach(([, rows]) => {
      rows.forEach((en) => {
        if (seen.has(en.ticker)) return;
        const hit =
          en.ticker.includes(q) ||
          en.name.toUpperCase().includes(q) ||
          en.sector.toUpperCase().includes(q);
        if (hit) {
          seen.set(en.ticker, en);
        }
      });
    });
    return Array.from(seen.values()).sort((a, b) => (b.confluence_count - a.confluence_count) || (b.score - a.score));
  }, [globalSearch, filteredScannerMap]);

  // Active workspace list
  const activeItems = useMemo(() => {
    const base = [...(filteredScannerMap[selectedScanner] || [])];
    base.sort((a, b) => {
      if (sortBy === 'confluence') return (b.confluence_count - a.confluence_count) || (b.score - a.score);
      if (sortBy === 'score') return (b.score || 0) - (a.score || 0);
      if (sortBy === 'change_1d') return (b.change_pct || 0) - (a.change_pct || 0);
      if (sortBy === 'return_20d') return (b.return_20d_pct || 0) - (a.return_20d_pct || 0);
      if (sortBy === 'avg_vol') return (b.avg_vol_20_m || 0) - (a.avg_vol_20_m || 0);
      if (sortBy === 'market_cap') return (b.market_cap_b || 0) - (a.market_cap_b || 0);
      return (b.confluence_count - a.confluence_count) || (b.score - a.score);
    });
    return base;
  }, [filteredScannerMap, selectedScanner, sortBy]);

  // Summary metrics
  const hubKpis = useMemo(() => {
    const allKeys = Object.keys(filteredScannerMap);
    const activeScannersCount = allKeys.filter((k) => (filteredScannerMap[k]?.length || 0) > 0).length;
    const uniqueLiquid = new Set();
    Object.values(filteredScannerMap).forEach((rows) => rows.forEach((r) => uniqueLiquid.add(r.ticker)));
    const tripleConfluence = confluenceItems.filter((x) => x.confluence_count >= 3).length;
    return {
      activeScanners: activeScannersCount,
      totalScanners: allKeys.length,
      uniqueLiquidCount: uniqueLiquid.size,
      tripleConfluence
    };
  }, [filteredScannerMap, confluenceItems]);

  const handleCopyTicket = (e, item) => {
    e.stopPropagation();
    const tp = item.trade_plan || {};
    const txt = `[EXPERT SCREENER] $${item.ticker} (${item.name}) | Cap $${item.market_cap_b}B | Vol ${item.avg_vol_20_m}M ($${item.dollar_vol_m}M/d)\nPrice: $${item.price?.toFixed(2)} (${item.change_pct >= 0 ? '+' : ''}${item.change_pct}%) | 20D: ${item.return_20d_pct >= 0 ? '+' : ''}${item.return_20d_pct}%\nConfluence (${item.confluence_count} scanners): ${item.scanner_keys.join(', ')}\nSignal: ${item.metric}\nPlan: Entry $${tp.entry || item.price} | Stop $${tp.stop_loss || 'N/A'} (-${tp.risk_pct || 0}%) | T1 $${tp.target_1 || 'N/A'}`;
    navigator.clipboard.writeText(txt);
    setCopiedTicker(item.ticker);
    setTimeout(() => setCopiedTicker(null), 1600);
  };

  const renderSetupCardsGrid = (items) => {
    if (!items || items.length === 0) {
      return (
        <div
          style={{
            padding: '38px 24px',
            textAlign: 'center',
            background: 'rgba(15, 23, 42, 0.7)',
            borderRadius: '12px',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            color: '#94a3b8'
          }}
        >
          No setups pass the active liquidity/market-cap gate in this scanner. Try lowering Min Market Cap or Min Volume.
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(365px, 1fr))', gap: '14px' }}>
        {items.slice(0, 60).map((item) => {
          const tp = item.trade_plan || {};
          const confColor = item.confluence_count >= 4 ? '#f59e0b' : item.confluence_count >= 3 ? '#10b981' : '#38bdf8';
          return (
            <div
              key={item.ticker}
              onClick={() => onTickerClick && onTickerClick(item.ticker)}
              style={{
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(9, 14, 28, 0.98))',
                border: item.confluence_count >= 3 ? `1px solid ${confColor}66` : '1px solid rgba(51, 65, 85, 0.65)',
                borderRadius: '13px',
                padding: '14px 15px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.32)'
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.22rem', fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace' }}>${item.ticker}</span>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: '5px',
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        background: `${confColor}22`,
                        color: confColor,
                        border: `1px solid ${confColor}55`,
                        fontFamily: 'monospace'
                      }}
                    >
                      🔥 {item.confluence_count} {item.confluence_count === 1 ? 'Scanner' : 'Scanners'}
                    </span>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: '5px',
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        background: 'rgba(56, 189, 248, 0.16)',
                        color: '#7dd3fc',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        fontFamily: 'monospace'
                      }}
                    >
                      {Math.round(item.score)}/100
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '3px' }}>
                    {item.name} • <span style={{ color: '#64748b' }}>{item.sector}</span> • Cap <strong style={{ color: '#7dd3fc' }}>${item.market_cap_b}B</strong> • Vol{' '}
                    <strong style={{ color: '#34d399' }}>{item.avg_vol_20_m?.toFixed(2)}M</strong> (${item.dollar_vol_m}M/d)
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontFamily: 'monospace', shrink: 0 }}>
                  <div style={{ fontSize: '1.12rem', fontWeight: 800, color: '#f8fafc' }}>${item.price?.toFixed(2)}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: (item.change_pct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                    {(item.change_pct || 0) >= 0 ? '+' : ''}
                    {(item.change_pct || 0).toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Sparkline */}
              <MiniSetupSparkline sparkline={item.sparkline} ticker={item.ticker} />

              {/* Signal Summary */}
              {item.metric && (
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: '#cbd5e1',
                    background: 'rgba(2, 6, 23, 0.52)',
                    border: '1px solid rgba(51, 65, 85, 0.4)',
                    borderRadius: '7px',
                    padding: '6px 9px',
                    lineHeight: 1.4
                  }}
                >
                  {item.metric}
                </div>
              )}

              {/* Cross-Scanner Badges */}
              {item.scanner_keys && item.scanner_keys.length > 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {item.scanner_keys.slice(0, 4).map((sk) => (
                    <span
                      key={sk}
                      onClick={(e) => {
                        e.stopPropagation();
                        const owner = resolvedPillars.find((p) => p.keys.includes(sk));
                        if (owner) setActivePillar(owner.id);
                        setSelectedScanner(sk);
                      }}
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(30, 41, 59, 0.85)',
                        color: sk === selectedScanner ? '#34d399' : '#94a3b8',
                        border: sk === selectedScanner ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(71,85,105,0.45)',
                        cursor: 'pointer'
                      }}
                    >
                      {getScannerMeta(sk).title.replace(/^[^\w]+/, '').slice(0, 22)}
                    </span>
                  ))}
                  {item.scanner_keys.length > 4 && (
                    <span style={{ fontSize: '0.62rem', color: '#f59e0b', fontWeight: 700, padding: '2px 4px' }}>
                      +{item.scanner_keys.length - 4} more
                    </span>
                  )}
                </div>
              )}

              {/* Telemetry + Risk Bracket Strip */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '6px',
                  background: 'rgba(2, 6, 23, 0.65)',
                  padding: '7px 9px',
                  borderRadius: '8px',
                  border: '1px solid rgba(51, 65, 85, 0.5)',
                  fontFamily: 'monospace'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.57rem', color: '#94a3b8' }}>20D RETURN</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: (item.return_20d_pct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                    {(item.return_20d_pct || 0) >= 0 ? '+' : ''}{item.return_20d_pct || 0}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.57rem', color: '#94a3b8' }}>RVOL (20D)</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: (item.rvol_20 || 1) >= 1.3 ? '#38bdf8' : '#e2e8f0' }}>
                    {(item.rvol_20 || 1).toFixed(2)}x
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.57rem', color: '#94a3b8' }}>STOP LOSS</div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#f43f5e' }}>
                    {tp.stop_loss ? `$${tp.stop_loss}` : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.57rem', color: '#94a3b8' }}>TARGET 1 (2R)</div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#10b981' }}>
                    {tp.target_1 ? `$${tp.target_1}` : '—'}
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                <button
                  type="button"
                  onClick={(e) => handleCopyTicket(e, item)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(148,163,184,0.35)',
                    background: 'rgba(15,23,42,0.8)',
                    color: copiedTicker === item.ticker ? '#10b981' : '#cbd5e1',
                    fontSize: '0.67rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {copiedTicker === item.ticker ? <Check size={11} /> : <Copy size={11} />}
                  {copiedTicker === item.ticker ? 'Copied' : 'Ticket'}
                </button>
                {onOpenFundamentals && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenFundamentals(item.ticker);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(56,189,248,0.4)',
                      background: 'rgba(56,189,248,0.12)',
                      color: '#7dd3fc',
                      fontSize: '0.67rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Layers size={11} /> Fundamentals
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMatrixTable = (items) => {
    if (!items || items.length === 0) return renderSetupCardsGrid([]);
    return (
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(51, 65, 85, 0.6)',
          borderRadius: '12px',
          overflowX: 'auto'
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.6)', background: 'rgba(2, 6, 23, 0.78)', color: '#94a3b8', fontSize: '0.67rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '11px 14px' }}>Ticker / Sector</th>
              <th style={{ padding: '11px 10px' }}>Price / 1D</th>
              <th style={{ padding: '11px 10px' }}>20D Ret</th>
              <th style={{ padding: '11px 10px' }}>Cap / Avg Vol</th>
              <th style={{ padding: '11px 10px' }}>RVOL</th>
              <th style={{ padding: '11px 10px' }}>Score</th>
              <th style={{ padding: '11px 10px' }}>Confluence</th>
              <th style={{ padding: '11px 10px' }}>Scanner Signal</th>
              <th style={{ padding: '11px 14px' }}>Stop / T1</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 60).map((item) => {
              const tp = item.trade_plan || {};
              return (
                <tr
                  key={item.ticker}
                  onClick={() => onTickerClick && onTickerClick(item.ticker)}
                  style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.35)', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace' }}>${item.ticker}</div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                      {item.name} • <span style={{ color: '#64748b' }}>{item.sector}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                    <div style={{ fontWeight: 800, color: '#e2e8f0' }}>${item.price?.toFixed(2)}</div>
                    <div style={{ fontSize: '0.68rem', color: (item.change_pct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                      {(item.change_pct || 0) >= 0 ? '+' : ''}{(item.change_pct || 0).toFixed(2)}%
                    </div>
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 800, color: (item.return_20d_pct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                    {(item.return_20d_pct || 0) >= 0 ? '+' : ''}{item.return_20d_pct || 0}%
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                    <div style={{ fontWeight: 700, color: '#7dd3fc' }}>${item.market_cap_b}B</div>
                    <div style={{ fontSize: '0.66rem', color: '#34d399' }}>
                      {item.avg_vol_20_m?.toFixed(2)}M (${item.dollar_vol_m}M/d)
                    </div>
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 700, color: (item.rvol_20 || 1) >= 1.3 ? '#38bdf8' : '#cbd5e1' }}>
                    {(item.rvol_20 || 1).toFixed(2)}x
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 800, color: '#7dd3fc' }}>
                    {Math.round(item.score)}/100
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 800, color: item.confluence_count >= 3 ? '#f59e0b' : '#38bdf8' }}>
                    🔥 {item.confluence_count}
                  </td>
                  <td style={{ padding: '10px', maxWidth: '300px', fontSize: '0.71rem', color: '#cbd5e1' }}>
                    {item.metric}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    <div style={{ color: '#f43f5e' }}>SL ${tp.stop_loss || '—'}</div>
                    <div style={{ color: '#10b981' }}>T1 ${tp.target_1 || '—'}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const selectedMeta = getScannerMeta(selectedScanner);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '28px' }}>
      {/* 1. COMMAND HUB EXECUTIVE HEADER + GLOBAL FILTERS */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(14, 29, 58, 0.9))',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '14px',
          padding: '18px 22px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span
                style={{
                  background: 'linear-gradient(135deg, #38bdf8, #10b981)',
                  color: '#02131f',
                  fontWeight: 900,
                  fontSize: '0.68rem',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  letterSpacing: '0.07em'
                }}
              >
                EXPERT SCREENERS COMMAND HUB 2.0
              </span>
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  fontWeight: 800,
                  fontSize: '0.67rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontFamily: 'monospace'
                }}
              >
                LIVE TELEMETRY: {screenerData?._metadata?.lakehouse_date || 'Today'} • {hubKpis.activeScanners}/{hubKpis.totalScanners} ACTIVE SCANNERS
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                {hubKpis.uniqueLiquidCount} Liquid Setups • {hubKpis.tripleConfluence} 3+ Scanner Confluence
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.42rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '9px' }}>
              <Flame size={22} color="#38bdf8" />
              Institutional Multi-Scanner Terminal &amp; Confluence Engine
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Global search across all scanners..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                style={{
                  padding: '7px 12px 7px 30px',
                  borderRadius: '8px',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  background: 'rgba(2, 6, 23, 0.8)',
                  color: '#f8fafc',
                  fontSize: '0.78rem',
                  width: '235px'
                }}
              />
            </div>

            <select
              value={minMcapB}
              onChange={(e) => setMinMcapB(Number(e.target.value))}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                background: 'rgba(2, 6, 23, 0.8)',
                color: '#7dd3fc',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <option value={0}>Cap: All</option>
              <option value={2}>Cap: ≥ $2B</option>
              <option value={10}>Cap: ≥ $10B</option>
              <option value={50}>Cap: ≥ $50B</option>
              <option value={100}>Cap: ≥ $100B</option>
            </select>

            <select
              value={minVolM}
              onChange={(e) => setMinVolM(Number(e.target.value))}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                background: 'rgba(2, 6, 23, 0.8)',
                color: '#34d399',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <option value={0}>Vol: All</option>
              <option value={0.5}>Vol: ≥ 500K/d</option>
              <option value={1}>Vol: ≥ 1.0M/d</option>
              <option value={2}>Vol: ≥ 2.0M/d</option>
              <option value={5}>Vol: ≥ 5.0M/d</option>
            </select>

            <button
              type="button"
              onClick={() => setEquitiesOnly((v) => !v)}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: equitiesOnly ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(148, 163, 184, 0.4)',
                background: equitiesOnly ? 'rgba(16, 185, 129, 0.16)' : 'rgba(2, 6, 23, 0.75)',
                color: equitiesOnly ? '#34d399' : '#94a3b8',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {equitiesOnly ? '✓ Equities Only' : 'All (Incl. ETFs)'}
            </button>

            {onRefreshAll && (
              <button
                type="button"
                onClick={onRefreshAll}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(79, 172, 254, 0.45)',
                  background: 'rgba(79, 172, 254, 0.14)',
                  color: '#4facfe',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={13} /> Refresh All
              </button>
            )}
          </div>
        </div>

        {/* 7 Strategy Pillar Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {resolvedPillars.map((pillar) => {
            const active = activePillar === pillar.id && !globalSearch.trim();
            const count =
              pillar.id === 'confluence'
                ? confluenceItems.length
                : pillar.keys.reduce((acc, k) => acc + (filteredScannerMap[k]?.length || 0), 0);
            return (
              <button
                key={pillar.id}
                type="button"
                onClick={() => {
                  setGlobalSearch('');
                  setActivePillar(pillar.id);
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: '9px',
                  border: active ? `1px solid ${pillar.color}` : '1px solid rgba(71, 85, 105, 0.45)',
                  background: active ? `${pillar.color}22` : 'rgba(2, 6, 23, 0.55)',
                  color: active ? '#f8fafc' : '#94a3b8',
                  fontSize: '0.76rem',
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{pillar.label}</span>
                <span
                  style={{
                    fontSize: '0.67rem',
                    fontFamily: 'monospace',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: 'rgba(0,0,0,0.35)',
                    color: active ? pillar.color : '#cbd5e1'
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. GLOBAL SEARCH WORKSPACE (WHEN QUERY ACTIVE) */}
      {globalSearch.trim() ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.85)', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(56,189,248,0.35)' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc' }}>
              🔍 Global Multi-Scanner Search: &ldquo;{globalSearch.trim()}&rdquo; ({globalSearchMatches.length} liquid matches)
            </span>
            <button
              type="button"
              onClick={() => setGlobalSearch('')}
              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(148,163,184,0.4)', background: 'transparent', color: '#cbd5e1', fontSize: '0.74rem', cursor: 'pointer' }}
            >
              Clear Search
            </button>
          </div>
          {viewMode === 'table' ? renderMatrixTable(globalSearchMatches) : renderSetupCardsGrid(globalSearchMatches)}
        </div>
      ) : activePillar === 'confluence' ? (
        /* 3. DEDICATED MULTI-SCANNER CONFLUENCE TERMINAL */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              background: 'rgba(15, 23, 42, 0.85)',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(245, 158, 11, 0.4)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#fbbf24' }}>🔥 Minimum Confluence:</span>
              {[2, 3, 4].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setMinConfluenceFilter(lvl)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '7px',
                    border: minConfluenceFilter === lvl ? '1px solid #f59e0b' : '1px solid rgba(71,85,105,0.5)',
                    background: minConfluenceFilter === lvl ? 'rgba(245,158,11,0.22)' : 'rgba(2,6,23,0.55)',
                    color: minConfluenceFilter === lvl ? '#fcd34d' : '#94a3b8',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ≥ {lvl} Scanners
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(71,85,105,0.6)', background: 'rgba(2,6,23,0.75)', color: '#e2e8f0', fontSize: '0.75rem' }}
              >
                <option value="confluence">Sort: Most Scanners</option>
                <option value="score">Sort: Avg Score</option>
                <option value="change_1d">Sort: 1D Change %</option>
                <option value="return_20d">Sort: 20D Return %</option>
                <option value="avg_vol">Sort: Avg Volume</option>
                <option value="market_cap">Sort: Market Cap</option>
              </select>
              <button
                type="button"
                onClick={() => setViewMode((v) => (v === 'cards' ? 'table' : 'cards'))}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(71,85,105,0.6)', background: 'rgba(2,6,23,0.75)', color: '#cbd5e1', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {viewMode === 'cards' ? 'Matrix Table' : 'Card Grid'}
              </button>
            </div>
          </div>

          {viewMode === 'table' ? renderMatrixTable(confluenceItems) : renderSetupCardsGrid(confluenceItems)}
        </div>
      ) : (
        /* 4. MASTER-DETAIL SCANNER WORKSPACE */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(250px, 285px) minmax(0, 1fr)',
            gap: '16px',
            alignItems: 'start'
          }}
        >
          {/* Left Scanner Directory */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(51, 65, 85, 0.65)',
              borderRadius: '13px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              position: 'sticky',
              top: '16px'
            }}
          >
            <button
              type="button"
              onClick={() => setPillarOverviewMode((v) => !v)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: pillarOverviewMode ? `1px solid ${activePillarObj.color}` : '1px dashed rgba(148,163,184,0.35)',
                background: pillarOverviewMode ? `${activePillarObj.color}20` : 'rgba(2,6,23,0.45)',
                color: pillarOverviewMode ? '#f8fafc' : '#cbd5e1',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginBottom: '4px'
              }}
            >
              <LayoutGrid size={13} />
              {pillarOverviewMode ? '✓ Pillar Overview Active' : 'Pillar Top-5 Overview Grid'}
            </button>

            {(activePillarObj?.keys || []).map((key) => {
              const meta = getScannerMeta(key);
              const count = filteredScannerMap[key]?.length || 0;
              const isSel = !pillarOverviewMode && selectedScanner === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setPillarOverviewMode(false);
                    setSelectedScanner(key);
                    setShowMethodInfo(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    border: isSel ? `1px solid ${activePillarObj.color}` : '1px solid transparent',
                    background: isSel ? `${activePillarObj.color}1e` : 'transparent',
                    color: isSel ? '#f8fafc' : count > 0 ? '#cbd5e1' : '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: isSel ? 800 : 600, display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.25 }}>
                    {meta.icon}
                    <span>{meta.title}</span>
                  </span>
                  <span
                    style={{
                      fontSize: '0.67rem',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '999px',
                      background: count > 0 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(51, 65, 85, 0.35)',
                      color: count > 0 ? '#34d399' : '#64748b',
                      shrink: 0
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Active Scanner Workspace */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
            {pillarOverviewMode ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
                {(activePillarObj?.keys || []).map((key) => {
                  const meta = getScannerMeta(key);
                  const rows = (filteredScannerMap[key] || []).slice(0, 5);
                  return (
                    <div
                      key={key}
                      style={{
                        background: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid rgba(51, 65, 85, 0.6)',
                        borderRadius: '12px',
                        padding: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {meta.icon} {meta.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPillarOverviewMode(false);
                            setSelectedScanner(key);
                          }}
                          style={{ fontSize: '0.68rem', color: '#38bdf8', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontWeight: 700 }}
                        >
                          Open ({filteredScannerMap[key]?.length || 0}) →
                        </button>
                      </div>
                      {rows.length === 0 ? (
                        <div style={{ fontSize: '0.73rem', color: '#64748b', fontStyle: 'italic' }}>No setups pass active filters.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {rows.map((r) => (
                            <div
                              key={r.ticker}
                              onClick={() => onTickerClick && onTickerClick(r.ticker)}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '6px 9px',
                                borderRadius: '7px',
                                background: 'rgba(2, 6, 23, 0.55)',
                                border: '1px solid rgba(51, 65, 85, 0.45)',
                                cursor: 'pointer',
                                fontSize: '0.74rem'
                              }}
                            >
                              <span>
                                <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>${r.ticker}</strong>{' '}
                                <span style={{ color: '#94a3b8' }}>• ${r.market_cap_b}B • {r.avg_vol_20_m?.toFixed(1)}M</span>
                              </span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: (r.change_pct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                                ${r.price?.toFixed(2)} ({r.change_pct >= 0 ? '+' : ''}{r.change_pct}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : selectedScanner === 'clean_uptrend_9_13' ? (
              <CleanUptrendDashboard
                compact
                data={cleanUptrendData}
                onTickerClick={onTickerClick}
                onOpenFundamentals={onOpenFundamentals}
                onRefresh={onRefreshCleanUptrend}
              />
            ) : (
              <>
                {/* Selected Scanner Header Bar */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(51, 65, 85, 0.65)',
                    borderRadius: '12px',
                    padding: '14px 16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
                      {selectedMeta.icon}
                      <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: '#f8fafc' }}>
                        {selectedMeta.title}
                      </h3>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          background: 'rgba(16, 185, 129, 0.16)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.4)'
                        }}
                      >
                        {activeItems.length} Liquid Setups
                      </span>
                      {selectedMeta.desc && (
                        <button
                          type="button"
                          onClick={() => setShowMethodInfo((v) => !v)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(148,163,184,0.35)',
                            background: 'rgba(2,6,23,0.5)',
                            color: '#cbd5e1',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Info size={12} /> Rules {showMethodInfo ? '▲' : '▼'}
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(71,85,105,0.6)', background: 'rgba(2,6,23,0.75)', color: '#e2e8f0', fontSize: '0.75rem' }}
                      >
                        <option value="confluence">Sort: Scanner Confluence</option>
                        <option value="score">Sort: Scanner Score</option>
                        <option value="change_1d">Sort: 1D Change %</option>
                        <option value="return_20d">Sort: 20D Return %</option>
                        <option value="avg_vol">Sort: Avg Volume</option>
                        <option value="market_cap">Sort: Market Cap</option>
                      </select>

                      <div style={{ display: 'flex', background: 'rgba(2,6,23,0.7)', borderRadius: '8px', padding: '2px', border: '1px solid rgba(51,65,85,0.6)' }}>
                        <button
                          type="button"
                          onClick={() => setViewMode('cards')}
                          style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700, background: viewMode === 'cards' ? 'rgba(56,189,248,0.22)' : 'transparent', color: viewMode === 'cards' ? '#7dd3fc' : '#94a3b8' }}
                        >
                          Cards
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('table')}
                          style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700, background: viewMode === 'table' ? 'rgba(56,189,248,0.22)' : 'transparent', color: viewMode === 'table' ? '#7dd3fc' : '#94a3b8' }}
                        >
                          Matrix
                        </button>
                      </div>
                    </div>
                  </div>

                  {showMethodInfo && selectedMeta.desc && (
                    <div style={{ marginTop: '10px', padding: '9px 12px', borderRadius: '8px', background: 'rgba(2, 6, 23, 0.6)', borderLeft: '3px solid #38bdf8', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                      {selectedMeta.desc}
                    </div>
                  )}
                </div>

                {viewMode === 'table' ? renderMatrixTable(activeItems) : renderSetupCardsGrid(activeItems)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
