import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend, Cell, ComposedChart, Line, Bar, Area, LabelList } from 'recharts'
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, FileText, Activity, Filter, X, BarChart2, ActivitySquare, Compass, Search, Loader, Crosshair, Radio, HeartPulse, Maximize, Minimize, Send, Bot, User, Sun, BookOpen, Zap, Link, Star, List, CheckCircle2, Info, ShieldAlert, ShieldCheck, Target, Landmark, Waves, Flame, Rocket, Layers } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import CustomTradingChart from './CustomTradingChart'
import UnifiedPlotlyChart from './UnifiedPlotlyChart'
import DeepChartingTerminal from './DeepChartingTerminal'
import GexHeatmap from './GexHeatmap'
import VolatilitySurface3D from './VolatilitySurface3D'
import TradingViewSync from './TradingViewSync'
import EarningsEvasionTracker from './EarningsEvasionTracker'
import ZacksFundamentalReport from './ZacksFundamentalReport'
import DeepFundamentalsDashboard from './DeepFundamentalsDashboard'
import LiveAgentsDashboard from './LiveAgentsDashboard'
import RsLineScanner from './RsLineScanner'
import ScreenerMonitorDashboard from './ScreenerMonitorDashboard'
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";
import { PieChart as PieChartIcon } from 'lucide-react';
import { ScreenerDescriptions } from './ScreenerInfo';
import MarketHealthMacroStudio from './MarketHealthMacroStudio';
import { StockPersonalityBadge, RossHaberPersonalityPanel } from './StockPersonalityBadge';
import WeeklyPlaybookDashboard from './WeeklyPlaybookDashboard';
import SeasonalityRadarDashboard from './SeasonalityRadarDashboard';
import AiPlaybookDashboard from './AiPlaybookDashboard';
import AskAiLiveDashboard from './AskAiLiveDashboard';
import SwingTradingSystem from './SwingTradingSystem';
import OptionsIntelligenceScreener from './OptionsIntelligenceScreener';
import WyckoffScreener from './WyckoffScreener';
import ElliottWaveScreener from './ElliottWaveScreener';
import GannScreener from './GannScreener';
import StageCanslimScreener from './StageCanslimScreener';
import RrgMoneyFlowDashboard from './RrgMoneyFlowDashboard';
import SqueezeRadarDashboard from './SqueezeRadarDashboard';
import IntradayRadarDashboard from './IntradayRadarDashboard';
import CleanUptrendDashboard from './CleanUptrendDashboard';
import ExpertScreenersHub from './ExpertScreenersHub';
const COLORS = [
  "#4facfe", "#00f2fe", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899",
  "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#a855f7", "#eab308", "#f43f5e",
  "#0ea5e9", "#22c55e", "#d946ef", "#64748b", "#f87171", "#fbbf24", "#34d399"
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px' }}>
        <p style={{ color: '#fff', margin: '0 0 5px 0', fontWeight: 'bold' }}>{data.date || 'Current'}</p>
        <p style={{ color: '#4facfe', margin: 0 }}>RS-Ratio (Trend): {data.x}</p>
        <p style={{ color: '#f59e0b', margin: 0 }}>RS-Momentum: {data.y}</p>
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '5px' }}>(Click to view top stocks)</p>
      </div>
    );
  }
  return null;
};

const ScreenerCategories = {
  clean_uptrend_9_13: { title: "🚀 Clean Untangled Uptrend (9/13 SMA Inception)", icon: <TrendingUp color="#10b981" />, desc: "Exhaustive Inception Scanner: Detects uncorrupted, untangled bull stacks (Price >= 9 SMA > 13 SMA > 21 SMA > 50 SMA). Resolves 6-month base see-sawing, strictly weeds out mature trends running since April 2026, enforces 9-SMA respect (zero closes below 13 SMA), and catches clean uptrends that only recently started (4 to 30 days ago)." },
  wick_supply_absorption: { title: "🕯️ Supply Absorption Inside Prior Wick", icon: <Layers color="#f59e0b" />, desc: "Wyckoff Supply Absorption: Stocks coiling strictly inside the upper wick of 1, 2, or 3 days back without breaking down, absorbing overhead supply in Stage 2 uptrend well above all SMAs (Market Cap >= $2B, Daily Volume >= 5M)." },
  first_ma_pullback: { title: "🎯 First MA Pullback Rejection (Holy Grail Retest)", icon: <Target color="#10b981" />, desc: "Institutional Retest Engine: Stage 2 market leaders making their FIRST clean pullback back to the 21-EMA or 50-SMA with strong downside rejection, Volume Dry-Up (VDU <= 0.80x), or Pocket Pivot Reclaim." },
  realsimple_framework: { title: "🛡️ Real Simple Framework (Ariel Hernandez)", icon: <Target color="#38bdf8" />, desc: "Ariel Hernandez's Core System: 3-Line Execution Dashboard (9-EMA / 21-EMA / 50-SMA alignment), Relative Strength Line vs SPY outperformance, Volatility Contraction (VCP), and 3-Tier Progressive Exposure Risk Sizing." },
  best_acting_stocks: { title: "🔥 Best-Acting Stock Apex Radar", icon: <Star color="#fbbf24" />, desc: "5-Pillar Institutional Scoring System: Ranks top leaders by Welles Wilder ADX Trend Strength, Relative Strength vs SPY, Bullish EMA Stacks, Volume Accumulation Footprints, and 52-Week High Proximity." },
  emerging_leaders: { title: "⚡ Emerging Market Leaders (Early Coiling)", icon: <Flame color="#3b82f6" />, desc: "4-Pillar Discovery Engine: Multi-agent quantitative model identifying early-stage market leaders coiling in tight bases with RS Line leading divergence, MA pinch (<5%), Pocket Pivots, and Volume Dry-Up (VDU)." },
  deepvue_launchpad: { title: "DeepVue: Launchpad Setup", icon: <Rocket color="#f43f5e" />, desc: "TraderLion / Deepvue: Moving average convergence (21 SMA, 50 SMA, and 65 EMA pinch within 2.5%) with tight price action and Volume Dry-Up (VDU). Early low-risk entry inside bases." },
  chop_incubation_leaders: { title: "Next Leg Leaders (Chop Incubation)", icon: <ShieldCheck color="#10b981" />, desc: "William O'Neil's 5 Market Chop Rules: Stocks holding above their 50-day line with top-tier Relative Strength, tight base depth (<25%), and Volume Dry-Up (VDU) while the broader market consolidates." },
  relative_strength: { title: "Highest Relative Strength", icon: <TrendingUp color="#10b981" />, desc: "Top momentum stocks exhibiting the highest relative strength vs the S&P 500." },
  early_stage_2: { title: "Early Stage 2 Breakouts", icon: <Activity color="#4facfe" />, desc: "Stocks newly transitioning from a Stage 1 base into a Stage 2 uptrend with volume conviction." },
  darvas_about_to: { title: "Darvas: About to Breakout", icon: <Compass color="#a855f7" />, desc: "Nicolas Darvas boxes coiling tightly near their all-time highs, anticipating an imminent breakout." },
  darvas_strong: { title: "Darvas: Yesterday's Breakouts", icon: <CheckCircle2 color="#10b981" />, desc: "Stocks that successfully breached the upper limit of their Darvas Box in the prior trading session." },
  breakout_retest: { title: "Breakout Pivot Retest", icon: <ActivitySquare color="#fbbf24" />, desc: "A+ setups pulling back to perfectly retest a former breakout pivot on light volume." },
  base_pullback_ma: { title: "Squat Base & SMA Support", icon: <Filter color="#14b8a6" />, desc: "Squat bases finding strict mathematical support on the 10-day or 20-day moving average." },
  fresh_52w_high: { title: "Fresh 52-Week Highs", icon: <TrendingUp color="#f59e0b" />, desc: "Momentum leaders printing new 1-year highs." },
  all_time_high: { title: "All-Time Highs", icon: <BarChart2 color="#eab308" />, desc: "Elite market leaders currently trading at all-time historic highs in blue sky territory." },
  hve_volume: { title: "Volume Climax (HVE)", icon: <AlertCircle color="#3b82f6" />, desc: "Massive institutional 'High Volume Events' acting as footprints of accumulation or distribution." },
  hve_consolidation: { title: "Consolidation post-HVE", icon: <Filter color="#14b8a6" />, desc: "Tight price consolidation immediately following a massive volume climax, signaling absorption." },
  post_earning_reaction: { title: "Power Earnings Gap Up", icon: <TrendingUp color="#a855f7" />, desc: "Explosive gap-up moves triggered immediately after a massive earnings surprise." },
  post_earning_consolidation: { title: "Earnings Gap Consolidation", icon: <ActivitySquare color="#8b5cf6" />, desc: "High and tight flag structures forming strictly after a Power Earnings Gap." },
  weekly_cup_handle: { title: "Weekly Cup & Handle", icon: <Compass color="#4facfe" />, desc: "Classic CANSLIM weekly cup with handle formations ready for multimonth macro advances." },
  monthly_cup_handle: { title: "Monthly Cup & Handle", icon: <Compass color="#a855f7" />, desc: "Massive multi-year cup and handle bases designed for institutional super-cycle investments." },
  ipo_avwap: { title: "IPO AVWAP Bounce", icon: <Crosshair color="#ec4899" />, desc: "Recent IPOs pulling back and defending the crucial Anchored VWAP from their IPO debut day." },
  bullish_candlestick: { title: "Bullish Candlestick", icon: <TrendingUp color="#22c55e" />, desc: "Bullish engulfing or massive hammer candles appearing at crucial structural support levels." },
  bearish_candlestick: { title: "Bearish Candlestick", icon: <TrendingUp color="#ef4444" style={{ transform: 'rotate(180deg)' }} />, desc: "Bearish engulfing or shooting stars signaling trend exhaustion at the top of a run." },
  reversal: { title: "Bullish Reversal (Oversold Bounce)", icon: <RefreshCw color="#10b981" />, desc: "Deep oversold (RSI < 40) snapback setups flashing confirmed bullish reversal candlestick patterns." },
  smc_divergence_reversal: { title: "SMC: RSI Divergence + Liquidity Grab + CHoCH", icon: <Zap color="#10b981" />, desc: "Smart Money Concepts: Pure momentum exhaustion setups. Multi-pivot Bullish RSI divergence resolved with a Liquidity Grab (stop sweep) and Change of Character (CHoCH / market structure shift)." },
  smc_200w_sma_reversal: { title: "SMC: 200W-SMA Defense + CHoCH", icon: <Landmark color="#4facfe" />, desc: "Smart Money Concepts: Macro institutional line-in-the-sand defense. Stocks arriving from secular uptrends testing/sweeping the 200-Weekly SMA from the upside and reclaiming structure." },
  zacks_rank_1: { title: "Zacks Rank #1 (Strong Buy)", icon: <BookOpen color="#10b981" />, desc: "Strict fundamental filter showing only stocks with upward earnings estimate revisions and PEG < 2." },
  qullamaggie_parabolic: { title: "Qullamaggie: Parabolic Flag", icon: <TrendingUp color="#3b82f6" />, desc: "Fast-moving momentum stocks forming tight flags after 3+ consecutive up days. (Excludes intraday fades: requires daily close near highs)." },
  universal_takeout: { title: "Universal Takeout", icon: <Activity color="#8b5cf6" />, desc: "JAZZ Engine: Stocks taking out the highs of the previous two trading sessions with heavy volume." },
  regression_channel_breakout: { title: "Linear Regression Breakout", icon: <TrendingUp color="#3b82f6" />, desc: "Stocks breaking out above the +2 Standard Deviation upper band of their 120-day Logarithmic Linear Regression Channel." },
  val_rejection: { title: "Rolling VAL Rejection", icon: <RefreshCw color="#10b981" />, desc: "Stocks experiencing a bullish rejection off their Value Area Low (VAL). The engine scans both Rolling Quarter (last 63 days) and Fixed Calendar Quarter (YTD) profiles." },
  val_rejection_fixed: { title: "Fixed Quarterly VAL Rejection", icon: <RefreshCw color="#3b82f6" />, desc: "Stocks experiencing a bullish rejection strictly off their Calendar Year-To-Date (Fixed Quarter) Value Area Low." },
  vah_rejection: { title: "Rolling VAH Pullback Support", icon: <RefreshCw color="#f59e0b" />, desc: "Volume Profile (63-day Rolling): Price pulls back from above to test the Value Area High (VAH) and prints a bullish rejection candle, holding institutional expansion support." },
  vah_rejection_fixed: { title: "Fixed Quarterly VAH Pullback Support", icon: <RefreshCw color="#f59e0b" />, desc: "Volume Profile (Fixed Calendar Quarter): Price pulls back from above to test the Fixed Quarter VAH and prints a bullish rejection candle." },
  poc_rejection: { title: "Rolling POC Pullback Support", icon: <RefreshCw color="#ec4899" />, desc: "Volume Profile (63-day Rolling): Price pulls back to test the Point of Control (POC) high-volume node and rejects downward continuation, confirming fair value accumulation." },
  poc_rejection_fixed: { title: "Fixed Quarterly POC Pullback Support", icon: <RefreshCw color="#ec4899" />, desc: "Volume Profile (Fixed Calendar Quarter): Price pulls back to test the Point of Control (POC) high-volume node of the calendar quarter and holds support." },
  fvg_sma_confluence: { title: "SMC: FVG + SMA Confluence", icon: <Crosshair color="#ec4899" />, desc: "Smart Money Concepts: Price is retracing perfectly into a recent Bullish Fair Value Gap (FVG) that also aligns with a key SMA (10, 20, or 50)." },
  pending_breakout: { title: "Pending Breakout (Squeeze)", icon: <ActivitySquare color="#f43f5e" />, desc: "Extremely tight VCPs with dry volume, mathematically pre-coiled for an explosive gap-up." },
  long_base_breakout: { title: "3-Year Long Base", icon: <Compass color="#3b82f6" />, desc: "Massive 3-year structural bases breaking out, signaling a new secular macro paradigm." },
  medium_base_breakout: { title: "Medium Base (3mo - 2yr)", icon: <Compass color="#a855f7" />, desc: "Standard 3 to 24 month bases adhering to strict Minervini depth and VCP tightness rules." },
  low_volume_breakout: { title: "Quiet Breakout (>1.0x Vol)", icon: <ActivitySquare color="#a855f7" />, desc: "Mathematically confirmed medium base breakouts that lacked the explosive 1.5x pocket pivot volume." },
  qullamaggie_setup: { title: "Qullamaggie Episodic Pivot", icon: <TrendingUp color="#8b5cf6" />, desc: "Episodic pivots defined by Kristjan Qullamaggie: High-momentum, catalyst-driven, tight base breakouts." },
  rs_divergence: { title: "RS Line Divergence (New High)", icon: <Activity color="#10b981" />, desc: "Alpha indicator: The stock's Relative Strength line is making a new high *before* price does." },
  bull_flag_breakout: { title: "Bull Flag Breakout", icon: <TrendingUp color="#38bdf8" />, desc: ">15% pole rally followed by a tight <12% pullback flag, actively breaking out today on 1.5x volume." },
  bull_flag_pending: { title: "Bull Flag Pending Breakout", icon: <ActivitySquare color="#f43f5e" />, desc: "Perfectly formed Bull Flags currently coiling inside the flag structure waiting for the volume trigger." },
  earnings_surge: { title: "Earnings Surge (PEDP)", icon: <TrendingUp color="#ec4899" />, desc: "High Post-Earnings Drift Potential: Massive EPS beats corroborated by heavy upward analyst estimate revisions." }
}

export const fetchNoCache = (url, options = {}) => {
  const separator = url.includes('?') ? '&' : '?';
  return fetch(`${url}${separator}_t=${Date.now()}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...(options.headers || {})
    }
  });
};

const ScreenerPill = ({ item, rank, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshData = (e) => {
    if (e) e.stopPropagation();
    setLoading(true);
    setErrorMsg(null);
    fetch(`/api/search?ticker=${item.ticker}&t=${new Date().getTime()}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setErrorMsg(data.error);
        } else {
          setHealthData(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setErrorMsg("Network error");
        setLoading(false);
      });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!healthData && !loading && !errorMsg) {
      refreshData();
    }
  };

  return (
    <div 
      className="stock-pill" 
      style={{ position: 'relative', zIndex: isHovered ? 999 : 1, display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', cursor: 'pointer', background: isHovered ? 'rgba(79, 172, 254, 0.1)' : 'rgba(255,255,255,0.05)' }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {rank && <span style={{ color: '#4facfe', fontWeight: 'bold', minWidth: '25px' }}>#{rank}</span>}
        <strong>{item.ticker}</strong>
        {item.state_label && (
          <span style={{
            fontSize: '0.7rem',
            padding: '1px 6px',
            borderRadius: '4px',
            background: item.state === 'LAUNCHING' ? 'rgba(16, 185, 129, 0.2)' : item.state === 'DNB' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(251, 191, 36, 0.2)',
            color: item.state_color || '#fbbf24',
            border: `1px solid ${item.state_color || '#fbbf24'}`,
            fontWeight: 700,
            whiteSpace: 'nowrap'
          }}>
            {item.state_label}
          </span>
        )}
        {item.has_pocket_pivot && (
          <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid #a855f7', whiteSpace: 'nowrap' }} title="Pocket Pivot on Pad: Volume exceeded max down volume">
            ⚡ PP
          </span>
        )}
        {item.has_rs_high && (
          <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', border: '1px solid #f97316', whiteSpace: 'nowrap' }} title="RS Line at New 20-Day High while coiling">
            🔥 RS High
          </span>
        )}
      </div>
      <span style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'right' }}>{item.metric}</span>
      
      {isHovered && (
        <div style={{ position: 'absolute', top: 'calc(100% + 5px)', right: '0', width: '280px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #4facfe', borderRadius: '8px', padding: '1rem', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#4facfe' }}>Why Picked:</h4>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#fff' }}>{item.metric}</p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ margin: 0, color: '#10b981' }}>Health:</h4>
            <button onClick={refreshData} style={{ background: 'none', border: 'none', color: '#4facfe', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Refresh Data">
              <RefreshCw size={14} className={loading ? "spin" : ""} />
            </button>
          </div>
          {loading ? (
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}><Loader size={12} className="spin"/> Loading...</p>
          ) : healthData ? (
            <div>
              <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#fff' }}>Stage: <strong style={{ color: healthData.technicals.stage.includes('2') ? '#10b981' : healthData.technicals.stage.includes('4') ? '#ef4444' : '#f59e0b' }}>{healthData.technicals.stage}</strong></p>
              <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#fff' }}>Mom: <strong style={{ color: healthData.technicals.momentum_color === 'bullish' ? '#10b981' : '#ef4444' }}>{healthData.technicals.momentum_text}</strong></p>
              {healthData.score && <p style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>Master Score: <strong style={{ color: healthData.score >= 70 ? '#10b981' : healthData.score >= 40 ? '#f59e0b' : '#ef4444' }}>{healthData.score}/100</strong></p>}
              
              {healthData.trade_plan && (
                <>
                  <h4 style={{ margin: '1rem 0 0.5rem 0', color: '#f59e0b', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>Trade Plan (ATR)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Entry: <strong style={{ color: '#fff' }}>${healthData.trade_plan.entry}</strong></p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Risk: <strong style={{ color: '#fff' }}>{healthData.trade_plan.risk_pct}%</strong></p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Stop: <strong style={{ color: '#ef4444' }}>${healthData.trade_plan.stop_loss}</strong></p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#10b981' }}>Target: <strong style={{ color: '#10b981' }}>${healthData.trade_plan.profit_target}</strong></p>
                  </div>
                </>
              )}

              {/* Ross Haber Stock Personality Card */}
              {healthData.personality && (
                <StockPersonalityBadge personality={healthData.personality} />
              )}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#ef4444' }}>{errorMsg || 'Data unavailable'}</p>
          )}
        </div>
      )}
    </div>
  );
};

function App() {
  const [data, setData] = useState(null)
  const [screenerData, setScreenerData] = useState(null)
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const hash = window.location.hash.replace(/^#\/?/, '');
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      return tabParam || hash || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash) setActiveTab(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const setTabWithHash = (tab) => {
    try {
      window.location.hash = tab;
    } catch (e) {}
    setActiveTab(tab);
  };
  const [timeframe, setTimeframe] = useState('daily')
  const [hiddenLines, setHiddenLines] = useState({})
  
  // UX State
  const [hoveredSector, setHoveredSector] = useState(null)
  const [isTop5Isolated, setIsTop5Isolated] = useState(false)
  const [modalData, setModalData] = useState(null)
  const [expandedCategories, setExpandedCategories] = useState({})
  const [collapsedCategories, setCollapsedCategories] = useState(
    Object.keys(ScreenerCategories).reduce((acc, key) => ({ ...acc, [key]: key !== 'clean_uptrend_9_13' }), {})
  )
  const [infoVisible, setInfoVisible] = useState({});
  
  // Full-Stack Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [expertTickerData, setExpertTickerData] = useState(null)
  const [briefingData, setBriefingData] = useState(null)
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false)
  const [chartMode, setChartMode] = useState('advanced') // Default to advanced with drawing tools
  
  // Live Agent Chat & Real-Time Alert Stream State
  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [agentPersona, setAgentPersona] = useState('quant') // quant, options, macro
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [streamStatus, setStreamStatus] = useState('connecting') // 'live' | 'connecting' | 'polling'
  const [lastSyncTime, setLastSyncTime] = useState('')
  const [isRefreshingAlerts, setIsRefreshingAlerts] = useState(false)

  const formatAlertMessage = (alert) => {
    if (!alert) return null;
    const ticker = alert.ticker || 'MARKET';
    const status = alert.status || 'TRIGGERED';
    const color = alert.color || (status in { "TRIGGERED": 1, "TARGET_HIT": 1, "TARGET_2_HIT": 1 } ? "#00E676" : status === "STOPPED_OUT" ? "#f43f5e" : "#10b981");
    
    let timeStr = alert.display_time || '';
    if (!timeStr && alert.timestamp) {
      try {
        const dt = new Date(alert.timestamp);
        if (!isNaN(dt.getTime())) {
          timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } else {
          timeStr = alert.timestamp;
        }
      } catch (e) {
        timeStr = alert.timestamp;
      }
    }
    if (!timeStr) timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let rawText = alert.setup || alert.message || '';
    if (!rawText) {
      rawText = `[LIVE ALERT] ${ticker}: ${status} - ${timeStr}`;
    }

    const id = alert.id || `${ticker}_${alert.timestamp || timeStr}_${rawText.slice(0, 25)}`;

    let council = alert.council;
    if (!council) {
      if (rawText.includes('SCREENER MONITOR')) council = '🎯 SCREENER MONITOR';
      else if (rawText.includes('PREMARKET')) council = '🌅 PREMARKET RADAR';
      else if (rawText.includes('AI COUNCIL')) council = '🏛️ AI COUNCIL';
      else if (rawText.includes('DARK POOL')) council = '🌊 DARK POOL';
      else if (rawText.includes('TECHNICAL')) council = '⚡ TECHNICAL COUNCIL';
      else council = '⚡ MARKET RADAR';
    }

    return {
      id,
      role: 'agent',
      isBroadcast: true,
      council,
      text: rawText,
      timeStr,
      color,
      ticker,
      payload: alert.payload,
      timestamp: alert.timestamp
    };
  };

  const mergeAlerts = (prevList, incomingList) => {
    const existingKeys = new Set(prevList.map(m => m.id || `${m.ticker}_${(m.text || '').slice(0, 40)}`));
    const newItems = [];
    for (const item of incomingList) {
      if (!item) continue;
      const key = item.id || `${item.ticker}_${(item.text || '').slice(0, 40)}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        newItems.push(item);
      }
    }
    if (newItems.length === 0) return prevList;
    return [...newItems, ...prevList].slice(0, 60);
  };
  
  // Intraday State
  const [intradayData, setIntradayData] = useState(null)
  const [intradayLoading, setIntradayLoading] = useState(false)
  
  // Market Health State
  const [marketHealth, setMarketHealth] = useState(null)
  const [marketCycle50y, setMarketCycle50y] = useState(null)
  
  // Squeeze State
  const [squeezeData, setSqueezeData] = useState(null)
  const [squeezeLoading, setSqueezeLoading] = useState(false)
  
  // Seasonality Radar State
  const [seasonalityData, setSeasonalityData] = useState(null)
  
  // DeepVue State
  const [deepvueData, setDeepvueData] = useState(null)
  
  // Best Acting Stocks State
  const [bestActingData, setBestActingData] = useState(null)
  
  // Upper Wick Supply Absorption State
  const [wickAbsorptionData, setWickAbsorptionData] = useState(null)
  
  // Clean Untangled Uptrend (9/13 SMA) State
  const [cleanUptrendData, setCleanUptrendData] = useState(null)
  const [realsimpleData, setRealsimpleData] = useState(null)
  const [firstMaPullbackData, setFirstMaPullbackData] = useState(null)
  
  // Advanced Analytics State
  const [correlationData, setCorrelationData] = useState(null)
  const [gexSearch, setGexSearch] = useState('')
  const [searchedGex, setSearchedGex] = useState(null)
  const [gexLoading, setGexLoading] = useState(false)
  const [gexError, setGexError] = useState('')
  
  // Historical DNA State
  const [dnaData, setDnaData] = useState(null)
  const [loadingDna, setLoadingDna] = useState(false)
  
  const fetchDNA = async (ticker) => {
    setLoadingDna(true);
    setDnaData(null);
    try {
      const res = await fetch(`/api/dna?ticker=${encodeURIComponent(ticker)}&_t=${Date.now()}`);
      const data = await res.json();
      setDnaData(data);
    } catch (e) {
      console.error(e);
    }
    setLoadingDna(false);
  };
  
  // Playbook State
  const [playbookContent, setPlaybookContent] = useState('')
  const [weeklyPlaybook, setWeeklyPlaybook] = useState(null)

  // Emerging Leaders State
  const [emergingLeadersData, setEmergingLeadersData] = useState(null)
  
  // Global Live Alerts State
  const [globalLiveAlerts, setGlobalLiveAlerts] = useState([])

  // Foldable Live Market Updates Panel & Banner States
  const [isLiveUpdatesFolded, setIsLiveUpdatesFolded] = useState(() => {
    try {
      const saved = localStorage.getItem('isLiveUpdatesFolded')
      return saved ? JSON.parse(saved) : false
    } catch (e) {
      return false
    }
  })

  const [isLiveAlertsBannerFolded, setIsLiveAlertsBannerFolded] = useState(() => {
    try {
      const saved = localStorage.getItem('isLiveAlertsBannerFolded')
      return saved ? JSON.parse(saved) : false
    } catch (e) {
      return false
    }
  })

  const toggleLiveUpdates = () => {
    setIsLiveUpdatesFolded(prev => {
      const next = !prev
      try {
        localStorage.setItem('isLiveUpdatesFolded', JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }

  const toggleLiveAlertsBanner = () => {
    setIsLiveAlertsBannerFolded(prev => {
      const next = !prev
      try {
        localStorage.setItem('isLiveAlertsBannerFolded', JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }

  const fetchAllData = useCallback(() => {
    fetchNoCache('/sector_flow.json')
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => console.error("Error fetching data:", err))
      
    fetchNoCache('/screener_results.json')
      .then(res => res.json())
      .then(data => setScreenerData(prev => ({ ...(prev || {}), ...data })))
      .catch(err => console.error("Error loading screener data:", err))
      
    fetchNoCache('/first_ma_pullback_results.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.results) {
          setFirstMaPullbackData(data);
          const formatted = data.results.map(s => ({
            ticker: s.ticker,
            metric: `$${s.close} | 1st Retest ${s.ma_tested} ($${s.ma_price}) | Impulse +${s.impulse_gain_pct}% | ${s.volume_footprint}`
          }));
          setScreenerData(prev => ({ ...(prev || {}), first_ma_pullback: formatted }));
        }
      })
      .catch(err => console.warn("First MA pullback results unavailable", err))

    fetchNoCache('/realsimple_results.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.stocks) {
          setRealsimpleData(data);
        }
      })
      .catch(err => console.warn("RealSimple results unavailable", err))
      
    fetchNoCache('/emerging_leaders.json')
      .then(res => res.json())
      .then(data => setEmergingLeadersData(data))
    fetchNoCache('/clean_uptrend_results.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.stocks) {
          setCleanUptrendData(data);
          const formatted = data.stocks.map(s => ({
            ticker: s.ticker,
            metric: `$${s.close.toFixed(2)} (${s.change_pct > 0 ? '+' : ''}${s.change_pct}%) · Started ${s.streak_days}d ago (${s.trend_start_date}) · 200-SMA: +${s.dist_200sma_pct}% (${s.streak_above_200}d) · 50-SMA: +${s.dist_50sma_pct}% · 9-SMA: ${s.dist_9sma_pct > 0 ? '+' : ''}${s.dist_9sma_pct}% · Respect: ${s.respect_9sma_pct}% · ${s.badges ? s.badges.join(' ') : ''}`,
            score: s.score,
            streak_days: s.streak_days,
            macro_breakout_bars: s.macro_breakout_bars,
            streak_above_200: s.streak_above_200,
            trend_start_date: s.trend_start_date,
            dist_9sma_pct: s.dist_9sma_pct,
            dist_50sma_pct: s.dist_50sma_pct,
            dist_200sma_pct: s.dist_200sma_pct,
            respect_9sma_pct: s.respect_9sma_pct,
            efficiency_ratio: s.efficiency_ratio,
            state_label: s.badges ? s.badges[0] : 'UNTANGLED',
            state_color: s.is_100_pct_rider ? '#10b981' : '#38bdf8',
            badges: s.badges,
            desk_notes: s.desk_notes
          }));
          setScreenerData(prev => ({ ...(prev || {}), clean_uptrend_9_13: formatted }));
        }
      })
      .catch(err => console.warn("Clean uptrend results unavailable", err))

    fetchNoCache('/wick_absorption_results.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.results) {
          setWickAbsorptionData(data);
          const formatted = data.results.map(s => ({
            ticker: s.ticker,
            metric: `$${s.close} | ${s.tier_badge} | Wick: ${s.wick_zone} | VDU: ${s.vdu_pct}% | Mcap: $${s.market_cap_b}B | Vol: ${s.avg_vol_20d_m}M`,
            score: s.score,
            tier: s.tier
          }));
          setScreenerData(prev => ({ ...(prev || {}), wick_supply_absorption: formatted }));
        }
      })
      .catch(err => console.warn("Wick absorption results unavailable", err))
      
    fetchNoCache('/best_acting_stocks.json')
      .then(res => res.json())
      .then(data => setBestActingData(data))
      .catch(err => console.error("Error loading best acting stocks data:", err))
      
    fetchNoCache('/market_health.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(text => {
        const sanitized = text.replace(/:\s*NaN\b/g, ': null').replace(/:\s*undefined\b/g, ': null');
        const data = JSON.parse(sanitized);
        setMarketHealth(data);
      })
      .catch(err => console.warn("Market health data unavailable", err))

    fetchNoCache('/market_cycle_50y.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(text => {
        const sanitized = text.replace(/:\s*NaN\b/g, ': null').replace(/:\s*undefined\b/g, ': null');
        setMarketCycle50y(JSON.parse(sanitized));
      })
      .catch(() => {
        fetch('/api/market_cycle_50y')
          .then(r => (r.ok ? r.json() : null))
          .then(d => { if (d && d.current_verdict) setMarketCycle50y(d); })
          .catch(() => {});
      })

    fetchNoCache('/weekly_playbook.json')
      .then(res => res.json())
      .then(data => setWeeklyPlaybook(data))
      .catch(err => console.warn("Weekly playbook unavailable", err))
      
    fetchNoCache('/api/squeeze/radar')
      .then(res => res.ok ? res.json() : fetchNoCache('/squeeze_results.json').then(r => r.json()))
      .then(data => setSqueezeData(data))
      .catch(err => console.error("Error loading squeeze data:", err))
      
    fetchNoCache('/seasonality_results.json')
      .then(res => res.json())
      .then(data => setSeasonalityData(data))
      .catch(err => console.error("Error loading seasonality data:", err))
      
    fetchNoCache('/deepvue_results.json')
      .then(res => res.json())
      .then(data => setDeepvueData(data))
      .catch(err => console.error("Error loading deepvue data:", err))
      
    fetchNoCache('/api/best_acting_stocks')
      .then(res => res.json())
      .then(data => {
        if (data && data.stocks) {
          const formatted = data.stocks.map(s => ({
            ticker: s.ticker,
            metric: `Score ${s.score}/100 | ADX ${s.adx} ${s.badges.join(' ')}`
          }));
          setScreenerData(prev => ({ ...(prev || {}), best_acting_stocks: formatted }));
        }
      })
      .catch(err => console.error("Error loading best acting stocks:", err))

    fetchNoCache('/api/realsimple_framework')
      .then(res => res.json())
      .then(data => {
        if (data && data.stocks) {
          const formatted = data.stocks.map(s => ({
            ticker: s.ticker,
            metric: `${s.setup_type} | ${s.exposure_action} | RS: +${s.rs_outperformance_pct}%`
          }));
          setScreenerData(prev => ({ ...(prev || {}), realsimple_framework: formatted }));
        }
      })
      .catch(err => console.error("Error loading RealSimple framework:", err))
      
    fetchNoCache('/first_ma_pullback_results.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.results) {
          const formatted = data.results.filter(s => s.close >= 5.0).map(s => ({
            ticker: s.ticker,
            metric: `Rejection off ${s.ma_tested} ($${s.ma_price}) | +${s.rejection_dist_pct}% | ${s.volume_footprint}`
          }));
          setScreenerData(prev => ({ ...(prev || {}), first_ma_pullback: formatted }));
        }
      })
      .catch(err => console.error("Error loading first MA pullback data:", err))

    fetchNoCache('/correlation_results.json')
      .then(res => res.json())
      .then(data => setCorrelationData(data))
      .catch(err => console.error("Error loading correlation data:", err))

    fetchNoCache('/ai_playbook.md')
      .then(res => res.text())
      .then(text => setPlaybookContent(text))
      .catch(err => console.error("Error loading playbook:", err))
      
    fetchNoCache('/intraday_results.json')
      .then(res => res.json())
      .then(json => setIntradayData(json))
      .catch(err => console.error("Error loading intraday data:", err))
      
    fetchNoCache('/alerts.json')
      .then(res => res.json())
      .then(alerts => {
        if (Array.isArray(alerts) && alerts.length > 0) {
          const formatted = alerts.map(formatAlertMessage).filter(Boolean);
          setChatHistory(prev => mergeAlerts(prev, formatted));
          setLastSyncTime(new Date().toLocaleTimeString());
        }
      })
      .catch(err => console.debug("Initial alerts history load skipped:", err));
  }, []);

  useEffect(() => {
    fetchAllData();
    // Auto-refresh main dashboard data every 1 minute
    const dataInterval = setInterval(fetchAllData, 60000);
      
    // Live Agent SSE Streaming Integration
    const eventSource = new EventSource('/api/stream');
    eventSource.onopen = () => {
      setStreamStatus('live');
    };
    eventSource.onmessage = (event) => {
      try {
        if (!event.data || !event.data.trim()) return;
        const alert = JSON.parse(event.data);
        const slackMessage = formatAlertMessage(alert);
        if (slackMessage) {
          setChatHistory(prev => mergeAlerts(prev, [slackMessage]));
          setLastSyncTime(new Date().toLocaleTimeString());
          
          // Push live breakouts to global banner
          if (alert.council && (alert.council.includes('INTRADAY') || alert.council.includes('SCREENER') || alert.council.includes('RADAR'))) {
            setGlobalLiveAlerts(prev => {
              const newBannerAlert = { ticker: alert.ticker, msg: alert.setup || alert.message };
              return [newBannerAlert, ...prev].slice(0, 10);
            });
          }
        }
      } catch (err) {
        // Keepalive comments or minor parse errors ignored
      }
    };
    eventSource.onerror = () => {
      setStreamStatus('polling');
    };
    
    return () => {
      eventSource.close();
      clearInterval(dataInterval);
    };
  }, [])

  // Ultra-fast 15s live tape polling while viewing Intraday Radar
  useEffect(() => {
    if (activeTab !== 'intraday') return;
    let cancelled = false;
    const pollIntraday = async () => {
      try {
        const res = await fetch(`/intraday_results.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json && Array.isArray(json.results)) {
          setIntradayData(json);
        }
      } catch (err) {
        console.debug("Intraday 15s poll skipped:", err);
      }
    };
    const fastInterval = setInterval(pollIntraday, 15000);
    return () => {
      cancelled = true;
      clearInterval(fastInterval);
    };
  }, [activeTab]);
  
  // Global Alert Polling Fallback
  useEffect(() => {
    const pollAlerts = async () => {
      try {
        const res = await fetch('/live_market_alerts.json?t=' + Date.now());
        if (res.ok) {
          const json = await res.json();
          setGlobalLiveAlerts(prev => {
            const sseAlerts = prev.filter(a => a.msg !== undefined);
            const polledAlerts = json.alerts || [];
            return [...sseAlerts, ...polledAlerts].slice(0, 15);
          });
        }
      } catch (err) {}

      // Keep Live Market Updates sidebar continuously synced from alerts.json
      try {
        const aRes = await fetch('/alerts.json?t=' + Date.now());
        if (aRes.ok) {
          const alerts = await aRes.json();
          if (Array.isArray(alerts) && alerts.length > 0) {
            const formatted = alerts.slice(0, 30).map(formatAlertMessage).filter(Boolean);
            setChatHistory(prev => mergeAlerts(prev, formatted));
            setLastSyncTime(new Date().toLocaleTimeString());
          }
        }
      } catch (err) {}
    };
    pollAlerts();
    const interval = setInterval(pollAlerts, 8000);
    return () => clearInterval(interval);
  }, [])

  const handleGexSearch = async (e) => {
    e.preventDefault();
    if (!gexSearch) return;
    setGexLoading(true);
    setGexError('');
    setSearchedGex(null);
    try {
      const res = await fetch(`/api/gex?ticker=${gexSearch}`);
      const data = await res.json();
      if (data.error) {
        setGexError(data.error);
      } else {
        setSearchedGex(data);
      }
    } catch (err) {
      setGexError("Failed to connect to backend");
    } finally {
      setGexLoading(false);
    }
  };

  const isDecliningStage = (stage) => {
    if (!stage) return false;
    const s = stage.toLowerCase();
    return s.includes('stage 4') || s.includes('declining') || s.includes('breakdown') || s.includes('stage 3') || s.includes('distribution');
  };

  const multiTimeframeFocusList = useMemo(() => {
    if (!data || !data.rrg) return [];
    
    const monthly = data.rrg.monthly || [];
    const weekly = data.rrg.weekly || [];
    const daily = data.rrg.daily || [];

    const focusStocksMap = new Map();

    monthly.forEach(mSector => {
      if (!mSector.trail || mSector.trail.length === 0) return;
      const mCur = mSector.trail[mSector.trail.length - 1];
      
      const wSector = weekly.find(s => s.ticker === mSector.ticker);
      if (!wSector || !wSector.trail || wSector.trail.length === 0) return;
      const wCur = wSector.trail[wSector.trail.length - 1];

      const dSector = daily.find(s => s.ticker === mSector.ticker);
      if (!dSector || !dSector.trail || dSector.trail.length < 2) return;
      const dCur = dSector.trail[dSector.trail.length - 1];
      const dPrev = dSector.trail[dSector.trail.length - 2];

      // Logic: Monthly Y > 100, Weekly X > 100, Daily Y > 100 and Y hooking up
      if (mCur.y > 100 && wCur.x > 100 && dCur.y > 100 && dCur.y > dPrev.y) {
        if (mSector.top_stocks) {
          mSector.top_stocks.forEach(stock => {
            if (isDecliningStage(stock.stage)) return;
            focusStocksMap.set(stock.ticker, {
              ...stock,
              sectorName: mSector.name,
              sectorTicker: mSector.ticker
            });
          });
        }
      }
    });

    return Array.from(focusStocksMap.values()).sort((a, b) => b.rs_spy_1mo - a.rs_spy_1mo).slice(0, 15);
  }, [data]);

  const emergingLeadersList = useMemo(() => {
    if (!data || !data.rrg) return [];
    
    const weekly = data.rrg.weekly || [];
    const daily = data.rrg.daily || [];

    const emergingStocksMap = new Map();

    weekly.forEach(wSector => {
      if (!wSector.trail || wSector.trail.length === 0) return;
      const wCur = wSector.trail[wSector.trail.length - 1];

      const dSector = daily.find(s => s.ticker === wSector.ticker);
      if (!dSector || !dSector.trail || dSector.trail.length < 2) return;
      const dCur = dSector.trail[dSector.trail.length - 1];
      const dPrev = dSector.trail[dSector.trail.length - 2];

      // Logic: Weekly is Improving / Early Rotation (wX < 105 and wY > 95)
      // OR Daily is hooking up strongly into leadership (dY > 100 and dY > dPrev)
      if ((wCur.x < 105 && wCur.y > 95) || (dCur.y > 100 && dCur.y > dPrev.y)) {
        if (wSector.top_stocks) {
          wSector.top_stocks.forEach(stock => {
            if (isDecliningStage(stock.stage)) return;
            // We only want FRESH emerging leaders, not mature/extended Stage 2 stocks like FTNT
            if (stock.dist_200sma && stock.dist_200sma > 20) return;
            emergingStocksMap.set(stock.ticker, {
              ...stock,
              sectorName: wSector.name,
              sectorTicker: wSector.ticker
            });
          });
        }
      }
    });

    return Array.from(emergingStocksMap.values()).sort((a, b) => b.rs_spy_1mo - a.rs_spy_1mo).slice(0, 15);
  }, [data]);

  if (!data || !data.rrg) {
    return <div className="loading"><RefreshCw size={48} /><h2>Loading Sector Tracker Engine...</h2></div>
  }

  const rrgData = data.rrg[timeframe] || [];
  const marketMeter = data.market_meter;
  const tableData = [...rrgData].sort((a, b) => b.trail[b.trail.length - 1].x - a.trail[a.trail.length - 1].x)

  const getQuadrant = (x, y) => {
    if (x >= 100 && y >= 100) return 'Leading';
    if (x >= 100 && y < 100) return 'Weakening';
    if (x < 100 && y < 100) return 'Lagging';
    if (x < 100 && y >= 100) return 'Improving';
    return 'Unknown';
  };

  const getMultiTimeframeSummary = () => {
    const playbooks = {
      pullbackBuys: [],
      emergingLeaders: [],
      exhaustionWarnings: [],
      fullThrottle: []
    };

    const monthlyData = data.rrg?.monthly || [];
    const weeklyData = data.rrg?.weekly || [];
    const dailyData = data.rrg?.daily || [];

    if (!monthlyData.length || !weeklyData.length || !dailyData.length) return playbooks;

    monthlyData.forEach(mSector => {
      if (!mSector.trail || mSector.trail.length === 0) return;
      
      const wSector = weeklyData.find(s => s.name === mSector.name);
      const dSector = dailyData.find(s => s.name === mSector.name);
      
      if (!wSector || !wSector.trail || !dSector || !dSector.trail) return;

      const mCur = mSector.trail[mSector.trail.length - 1];
      const wCur = wSector.trail[wSector.trail.length - 1];
      const dCur = dSector.trail[dSector.trail.length - 1];

      const mQuad = getQuadrant(mCur.x, mCur.y);
      const wQuad = getQuadrant(wCur.x, wCur.y);
      const dQuad = getQuadrant(dCur.x, dCur.y);
      
      const topStocks = (dSector.top_stocks || []).slice(0, 3).map(s => s.ticker).join(", ");
      
      const sectorObj = { 
        name: mSector.name, 
        status: `[M: ${mQuad}] [W: ${wQuad}] [D: ${dQuad}]`,
        topStocks: topStocks ? `Top 3: ${topStocks}` : ''
      };

      // Pullback Buy: Monthly Up, Weekly Up, Daily Pulling Back
      if ((mQuad === 'Leading' || mQuad === 'Improving') && (wQuad === 'Leading') && (dQuad === 'Weakening' || dQuad === 'Lagging')) {
        playbooks.pullbackBuys.push(sectorObj);
      }
      // Emerging Leader: Monthly Beaten Down, Weekly turning, Daily Up
      else if ((mQuad === 'Lagging' || mQuad === 'Improving') && (wQuad === 'Improving' || wQuad === 'Leading') && (dQuad === 'Leading')) {
        playbooks.emergingLeaders.push(sectorObj);
      }
      // Exhaustion Warning: Monthly Leading, but lower timeframes breaking down
      else if (mQuad === 'Leading' && (wQuad === 'Weakening' || wQuad === 'Lagging') && (dQuad === 'Lagging')) {
        playbooks.exhaustionWarnings.push(sectorObj);
      }
      // Full Throttle: Everything is Leading
      else if (mQuad === 'Leading' && wQuad === 'Leading' && dQuad === 'Leading') {
        playbooks.fullThrottle.push(sectorObj);
      }
    });

    return playbooks;
  };
  const getRotationSummary = () => {
    const freshMoney = [];       // Dominant Trend Expansion (Leading)
    const earlyRotation = [];     // Early Trend Ignition (Improving + Rising RS-Momentum)
    const profitTaking = [];      // Distribution / Exhaustion Warning (Weakening / Hooking Down)
    const deadMoney = [];         // Capitulation / Structural Drag (Lagging)

    rrgData.forEach(sec => {
      if (!sec.trail || sec.trail.length === 0) return;
      const current = sec.trail[sec.trail.length - 1];
      const prev = sec.trail.length > 2 ? sec.trail[sec.trail.length - 2] : sec.trail[0];

      const isLeading = current.x >= 100 && current.y >= 100;
      const isImproving = current.x < 100 && current.y >= 100;
      const isWeakening = current.x >= 100 && current.y < 100;
      const isLagging = current.x < 100 && current.y < 100;

      const momRising = current.y > prev.y;
      const rsRising = current.x > prev.x;

      const rank = tableData.findIndex(s => s.name === sec.name) + 1;
      const topStocksStr = (sec.top_stocks || []).slice(0, 3).map(s => s.ticker).join(', ');

      const sectorObj = {
        name: sec.name,
        ticker: sec.ticker,
        rank: rank > 0 ? rank : 99,
        momRising,
        rsRising,
        topStocks: topStocksStr,
        x: current.x,
        y: current.y
      };

      if (isImproving && momRising) {
        // 1. Early Trend Ignition: Turning up from oversold/base
        earlyRotation.push(sectorObj);
      } else if (isLeading) {
        // 2. Dominant Trend Expansion: Active market leaders
        freshMoney.push(sectorObj);
      } else if (isWeakening || (isLeading && !momRising)) {
        // 3. Distribution & Exhaustion Warning: Leaders losing velocity or rolling over
        profitTaking.push(sectorObj);
      } else {
        // 4. Capitulation & Structural Drag: Trapped underperformance
        deadMoney.push(sectorObj);
      }
    });

    earlyRotation.sort((a, b) => b.y - a.y);
    freshMoney.sort((a, b) => a.rank - b.rank);
    profitTaking.sort((a, b) => a.rank - b.rank);
    deadMoney.sort((a, b) => a.rank - b.rank);

    return { earlyRotation, freshMoney, profitTaking, deadMoney };
  };
  const moneyFlow = getRotationSummary();

  const toggleLine = (name) => {
    if (isTop5Isolated) setIsTop5Isolated(false)
    setHiddenLines(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const isolateTop5 = () => {
    if (isTop5Isolated) {
      setIsTop5Isolated(false)
      setHiddenLines({})
    } else {
      const top5Sectors = tableData.slice(0, 5).map(item => item.name)
      const newHidden = {}
      rrgData.forEach(sec => newHidden[sec.name] = !top5Sectors.includes(sec.name))
      setHiddenLines(newHidden)
      setIsTop5Isolated(true)
    }
  }
  


  const fetchTickerData = async (ticker) => {
    const cleanSym = String(ticker || 'NVDA').trim().toUpperCase();
    setIsSearching(true);
    setSearchError(null);
    setExpertTickerData({ ticker: cleanSym });
    setModalData(null);
    setActiveTab('chart');
    setIsRightDrawerOpen(true);
    
    try {
      const res = await fetch(`/api/search?ticker=${ticker}&t=${new Date().getTime()}`);
      const json = await res.json();
      if (!res.ok) {
        setSearchError(json.error || "Failed to fetch data.");
      } else {
        setExpertTickerData(json);
      }
    } catch (err) {
      setSearchError(err.message || "Failed to reach backend server. Check server.py connection.");
    } finally {
      setIsSearching(false);
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setDnaData(null); // Reset DNA when searching a new ticker
    fetchTickerData(searchQuery.trim().toUpperCase());
  }

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const userMessage = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: chatInput, 
          ticker: expertTickerData ? expertTickerData.ticker : 'UNKNOWN',
          persona: agentPersona,
          context: expertTickerData || {}
        })
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'agent', text: data.response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'agent', text: 'Sorry, my connection to the mainframe dropped. Please try again.' }]);
    } finally {
      setIsChatLoading(false);
    }
  }
  
  const fetchIntradayAlerts = async (forceLive = false) => {
    const isAlreadyOnIntraday = activeTab === 'intraday';
    setActiveTab('intraday');
    setIntradayLoading(true);
    try {
      const endpoint = (forceLive === true || isAlreadyOnIntraday)
        ? `/api/intraday_radar?refresh=1&t=${Date.now()}`
        : `/intraday_results.json?t=${Date.now()}`;
      const res = await fetch(endpoint, { cache: 'no-store' });
      const json = await res.json();
      setIntradayData(json);
    } catch (err) {
      try {
        const resFallback = await fetch(`/intraday_results.json?t=${Date.now()}`, { cache: 'no-store' });
        const jsonFallback = await resFallback.json();
        setIntradayData(jsonFallback);
      } catch (e2) {
        console.error(e2);
      }
    } finally {
      setIntradayLoading(false);
    }
  }

  const openLocalTicker = (stock) => {
    setExpertTickerData({
      ticker: stock.ticker,
      name: "Component Stock",
      score: null,
      technicals: {
        perf: stock.perf,
        stage: stock.stage,
        momentum_text: stock.momentum_text,
        momentum_color: stock.momentum_color,
        rs_spy_1mo: stock.rs_spy_1mo
      },
      fundamentals: null
    });
  }

  const renderCustomLegend = (props) => {
    const { payload } = props;
    const unique = [];
    payload.forEach(p => { if (!unique.find(x => x.value === p.value)) unique.push(p); });
    
    return (
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
        {unique.map((entry, index) => (
          <li
            key={`item-${index}`}
            onClick={() => toggleLine(entry.value)}
            onMouseEnter={() => setHoveredSector(entry.value)}
            onMouseLeave={() => setHoveredSector(null)}
            style={{
              cursor: 'pointer',
              color: hiddenLines[entry.value] ? '#475569' : entry.color,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s ease',
              opacity: hoveredSector ? (hoveredSector === entry.value ? 1 : 0.3) : 1,
              transform: hoveredSector === entry.value ? 'scale(1.1)' : 'scale(1)'
            }}
          >
            <span style={{ 
              width: 12, height: 12, borderRadius: '50%', 
              backgroundColor: hiddenLines[entry.value] ? 'transparent' : entry.color,
              border: `2px solid ${entry.color}`
            }}></span>
            {entry.value}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
    <div className="app-layout">
      {/* Neo-Brutalist Sidebar */}
      <div className="sidebar-nav">
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #1e293b', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity color="#4facfe" /> SectorTracker
          </h1>
          <p style={{ margin: '0.5rem 0 0 0', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Institutional Terminal</p>
        </div>
        
        <div className="sidebar-menu">
          <button className={activeTab === 'dashboard' ? 'tab-active' : ''} onClick={() => setActiveTab('dashboard')}><Activity size={18} /> RRG Dashboard</button>
          <button className={activeTab === 'chart' ? 'tab-active' : ''} onClick={() => {
            setActiveTab('chart');
            if (!expertTickerData && !isSearching) {
              fetchTickerData('SPY');
            }
          }}><BarChart2 size={18} /> Deep Charting</button>
          <button 
            className={activeTab === 'agents' ? 'tab-active' : ''} 
            onClick={() => setActiveTab('agents')}
            style={{
              background: activeTab === 'agents' ? undefined : 'rgba(0, 240, 255, 0.08)',
              borderLeft: activeTab === 'agents' ? undefined : '3px solid #00F0FF',
              color: activeTab === 'agents' ? undefined : '#00F0FF',
              fontWeight: 700
            }}
          >
            <Bot size={18} color="#00F0FF" /> AI Market Agents 🤖
          </button>
          <button className={activeTab === 'screeners' ? 'tab-active' : ''} onClick={() => setActiveTab('screeners')}><Crosshair size={18} /> Expert Screeners</button>
          <button
            className={activeTab === 'clean_uptrend' ? 'tab-active' : ''}
            onClick={() => setActiveTab('clean_uptrend')}
            style={{ color: activeTab === 'clean_uptrend' ? '#10b981' : '#34d399' }}
          >
            <TrendingUp size={18} color="#10b981" /> Clean Uptrend 🚀
          </button>
          <button className={activeTab === 'screenermonitor' ? 'tab-active' : ''} onClick={() => setActiveTab('screenermonitor')}><Target size={18} /> Screener Monitor 🎯</button>
          <button 
            className={activeTab === 'swingsystem' ? 'tab-active' : ''} 
            onClick={() => setActiveTab('swingsystem')}
            style={{
              color: activeTab === 'swingsystem' ? '#00f2fe' : undefined,
              fontWeight: activeTab === 'swingsystem' ? 700 : undefined
            }}
          >
            <Target size={18} color="#00f2fe" /> 1-3W Swing System 🎯
          </button>
          <button className={activeTab === 'gexprofiler' ? 'tab-active' : ''} onClick={() => setActiveTab('gexprofiler')}><BarChart2 size={18} /> GEX Profiler</button>
          <button className={(activeTab === 'health' || activeTab === 'macromatrix') ? 'tab-active' : ''} onClick={() => setActiveTab('health')}><HeartPulse size={18} /> Market Health &amp; Macro</button>
          <button className={activeTab === 'playbook' ? 'tab-active' : ''} onClick={() => setActiveTab('playbook')}><BookOpen size={18} /> Weekly Playbook</button>
          <button className={activeTab === 'squeeze' ? 'tab-active' : ''} onClick={() => setActiveTab('squeeze')}><AlertCircle size={18} /> Squeeze Radar</button>
          <button className={activeTab === 'seasonality' ? 'tab-active' : ''} onClick={() => setActiveTab('seasonality')}><Compass size={18} /> Seasonality Radar</button>
          <button className={activeTab === 'intraday' ? 'tab-active' : ''} onClick={fetchIntradayAlerts}><Radio size={18} /> Intraday Radar</button>
          <button className={activeTab === 'rslinescanner' ? 'tab-active' : ''} onClick={() => setActiveTab('rslinescanner')}><Star size={18} /> RS Line Scanner</button>
          <button className={activeTab === 'volsurface' ? 'tab-active' : ''} onClick={() => setActiveTab('volsurface')}><Activity size={18} /> 3D Vol Surface</button>
          <button className={activeTab === 'options_screener' ? 'tab-active' : ''} onClick={() => setActiveTab('options_screener')} style={{ color: activeTab === 'options_screener' ? '#38bdf8' : undefined }}><Zap size={18} color="#38bdf8" /> Options Screener ⚡</button>
          <button className={activeTab === 'wyckoff' ? 'tab-active' : ''} onClick={() => setActiveTab('wyckoff')} style={{ color: activeTab === 'wyckoff' ? '#10b981' : undefined }}><Landmark size={18} color="#10b981" /> Wyckoff Screener 🏛️</button>
          <button className={activeTab === 'elliott_wave' ? 'tab-active' : ''} onClick={() => setActiveTab('elliott_wave')} style={{ color: activeTab === 'elliott_wave' ? '#38bdf8' : undefined }}><Waves size={18} color="#38bdf8" /> Elliott Wave 🌊</button>
          <button className={activeTab === 'gann' ? 'tab-active' : ''} onClick={() => setActiveTab('gann')} style={{ color: activeTab === 'gann' ? '#fbbf24' : undefined }}><Compass size={18} color="#fbbf24" /> Gann Wheel 📐</button>
          <button className={activeTab === 'stage_canslim' ? 'tab-active' : ''} onClick={() => setActiveTab('stage_canslim')} style={{ color: activeTab === 'stage_canslim' ? '#10b981' : undefined }}><Flame size={18} color="#10b981" /> Stage + CANSLIM 🚀</button>
          <button className={activeTab === 'earnings' ? 'tab-active' : ''} onClick={() => setActiveTab('earnings')}><User size={18} /> AI Earnings</button>
          <button className={activeTab === 'zacks' ? 'tab-active' : ''} onClick={() => setActiveTab('zacks')}><BookOpen size={18} /> Zacks Fundamentals</button>
          <button className={activeTab === 'deepfundamentals' ? 'tab-active' : ''} onClick={() => setActiveTab('deepfundamentals')}><PieChartIcon size={18} /> Deep Fundamentals</button>
          <button className={activeTab === 'analysis' ? 'tab-active' : ''} onClick={() => setActiveTab('analysis')}><FileText size={18} /> AI Playbook</button>
          <button className={activeTab === 'tvsync' ? 'tab-active' : ''} onClick={() => setActiveTab('tvsync')}><Link size={18} /> TradingView Sync</button>
          <button className={activeTab === 'ask_ai' ? 'tab-active' : ''} onClick={() => setActiveTab('ask_ai')} style={{ color: activeTab === 'ask_ai' ? '#c084fc' : undefined }}><Bot size={18} color="#c084fc" /> Ask AI Live 💬</button>
          <div style={{ marginTop: '1.25rem', padding: '0 10px', paddingBottom: '1rem' }}>
            <button 
              className="trade-button" 
              onClick={() => {
                fetch('/api/sync_lakehouse', { method: 'POST' });
                alert("Database Update & Scanner Engine started in the background. Please wait ~2 minutes for it to complete.");
              }} 
              style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}
            >
              <RefreshCw size={16} /> Sync Lakehouse
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="main-content"
        style={activeTab === 'chart' ? { padding: '0.65rem 0.9rem', width: '100%' } : undefined}
      >
        {/* Top Navbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: activeTab === 'chart' ? '0.6rem' : '2rem',
            paddingBottom: activeTab === 'chart' ? '0.5rem' : '1rem',
            borderBottom: '1px solid #1e293b',
          }}
        >
          <form onSubmit={handleSearch} style={{ display: 'flex', width: '400px', position: 'relative' }}>
            <input 
              type="text" placeholder="Search any US Ticker (e.g., AAPL)..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input" style={{ width: '100%' }}
            />
            <button type="submit" className="search-btn" disabled={isSearching}>
              {isSearching ? <Loader size={18} className="spin" /> : <Search size={18} />}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {marketMeter && (
              <div className="glass-card" style={{ padding: '0.5rem 1rem', borderLeft: `4px solid ${marketMeter.color}`, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Compass size={18} color={marketMeter.color} />
                <strong style={{ margin: 0, color: marketMeter.color, fontSize: '0.9rem' }}>Market Trend: {marketMeter.status}</strong>
              </div>
            )}

            {isLiveUpdatesFolded && (
              <button
                onClick={toggleLiveUpdates}
                title="Unfold Live Market Updates panel"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.5rem 0.9rem',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#10b981',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)'; }}
              >
                <Radio size={14} className={streamStatus === 'live' ? 'pulse' : ''} />
                <span>Live Market Updates</span>
                {chatHistory.filter(m => m.isBroadcast).length > 0 && (
                  <span style={{ fontSize: '0.65rem', background: '#10b981', color: '#000', padding: '1px 5px', borderRadius: '10px', fontWeight: 'bold' }}>
                    {chatHistory.filter(m => m.isBroadcast).length}
                  </span>
                )}
                <ChevronLeft size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Global Intraday Live Alerts Ticker */}
        {globalLiveAlerts.length > 0 && (
          isLiveAlertsBannerFolded ? (
            <div 
              style={{
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 14px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '6px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={toggleLiveAlertsBanner}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)'}
              title="Click to unfold Live Market Alerts banner"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                  <AlertCircle size={15} /> LIVE MARKET ALERTS ({globalLiveAlerts.length}):
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                  Latest: <strong style={{ color: '#fff' }}>{globalLiveAlerts[0]?.ticker}</strong> {globalLiveAlerts[0]?.msg || (globalLiveAlerts[0]?.pct_above ? `+${globalLiveAlerts[0].pct_above.toFixed(1)}%` : '')}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleLiveAlertsBanner(); }}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#94a3b8',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>Unfold Banner</span>
                <ChevronDown size={13} />
              </button>
            </div>
          ) : (
            <div className="marquee-container" style={{ marginBottom: '1.5rem', padding: '0.5rem 1rem', background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid #ef4444', borderRadius: '4px' }}>
                <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap', paddingRight: '15px', zIndex: 10, position: 'relative', background: '#09090b', boxShadow: '10px 0 15px #09090b' }}>
                    <AlertCircle size={16} /> LIVE ALERTS:
                </span>
                <div className="marquee-content">
                    {[...globalLiveAlerts, ...globalLiveAlerts].map((alert, i) => (
                        <div key={i} onClick={() => fetchTickerData(alert.ticker)} style={{ cursor: 'pointer', background: 'rgba(15, 23, 42, 0.8)', padding: '4px 10px', borderRadius: '4px', borderLeft: '2px solid #ef4444', display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.8)'}>
                            <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{alert.ticker}</strong>
                            {alert.pct_above !== undefined ? (
                              <>
                                <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem' }}>+{alert.pct_above.toFixed(2)}%</span>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                    Brk: ${alert.trigger_price.toFixed(2)} ➔ <strong style={{color: '#fff'}}>${alert.price.toFixed(2)}</strong>
                                </span>
                              </>
                            ) : (
                              <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '500' }}>{alert.msg}</span>
                            )}
                        </div>
                    ))}
                </div>
                <button
                  onClick={toggleLiveAlertsBanner}
                  title="Fold Live Alerts Banner"
                  style={{
                    zIndex: 10,
                    position: 'relative',
                    marginLeft: '8px',
                    background: '#09090b',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    boxShadow: '-10px 0 15px #09090b',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#09090b'; e.currentTarget.style.color = '#f87171'; }}
                >
                  <span>Fold</span>
                  <ChevronUp size={13} />
                </button>
            </div>
          )
        )}

      {activeTab === 'tvsync' && (
        <TradingViewSync />
      )}

      {activeTab === 'gexprofiler' && (
        <div style={{ width: '100%' }}>
          <GexHeatmap ticker={(searchedGex?.ticker) || expertTickerData?.ticker || 'SPY'} />
        </div>
      )}

      {activeTab === 'volsurface' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          <div 
            style={{
              padding: '1.5rem',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #0d121f 0%, #080c14 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.35)', color: '#00F0FF', display: 'flex' }}>
                  <Search size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: '1rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Institutional Volatility Manifold & Smile Screener
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                    Select or type any optionable equity/ETF to calibrate real-time 3D IV surface and algorithmic setups
                  </p>
                </div>
              </div>

              {/* Quick Ticker Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'AMD', 'META', 'AMZN', 'IWM'].map(sym => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => {
                      setGexSearch(sym);
                      setSearchedGex({ ticker: sym, ts: Date.now() });
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: ((searchedGex?.ticker) || expertTickerData?.ticker || 'SPY') === sym ? '1px solid #00F0FF' : '1px solid rgba(255,255,255,0.1)',
                      background: ((searchedGex?.ticker) || expertTickerData?.ticker || 'SPY') === sym ? 'rgba(6, 182, 212, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                      color: ((searchedGex?.ticker) || expertTickerData?.ticker || 'SPY') === sym ? '#00F0FF' : '#cbd5e1',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); const sym = (gexSearch || searchedGex?.ticker || expertTickerData?.ticker || 'SPY').toUpperCase(); setSearchedGex({ ticker: sym, ts: Date.now() }); }} style={{ display: 'flex', gap: '0.75rem' }}>
              <input 
                type="text" 
                placeholder="Enter ticker (e.g., TSLA, SPY, NVDA, AAPL)..." 
                value={gexSearch} 
                onChange={(e) => setGexSearch(e.target.value.toUpperCase())} 
                style={{ 
                  padding: '0.75rem 1rem', 
                  borderRadius: '10px', 
                  border: '1px solid rgba(255, 255, 255, 0.15)', 
                  background: 'rgba(5, 8, 16, 0.8)', 
                  color: 'white', 
                  flex: 1,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.9rem',
                  letterSpacing: '0.05em'
                }} 
              />
              <button 
                type="submit" 
                style={{ 
                  padding: '0.75rem 1.75rem', 
                  background: 'linear-gradient(135deg, #00F0FF 0%, #0ea5e9 100%)', 
                  borderRadius: '10px', 
                  border: 'none', 
                  color: '#09090b', 
                  cursor: 'pointer', 
                  fontWeight: 800,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.85rem',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  boxShadow: '0 4px 15px rgba(0, 240, 255, 0.35)'
                }}
              >
                Map Surface
              </button>
            </form>
          </div>

          <VolatilitySurface3D ticker={(searchedGex?.ticker) || expertTickerData?.ticker || 'SPY'} refreshKey={searchedGex?.ts || 0} />
        </div>
      )}

      {activeTab === 'options_screener' && (
        <OptionsIntelligenceScreener 
          onNavigateTab={(tab, targetTicker) => {
            if (tab === 'chart') {
              if (targetTicker) {
                fetchTickerData(targetTicker);
              } else {
                setActiveTab('chart');
              }
            } else if (tab === 'volsurface') {
              if (targetTicker) {
                setGexSearchInput(targetTicker);
                fetchGexData(targetTicker);
              }
              setActiveTab('volsurface');
            } else if (tab === 'gexprofiler') {
              if (targetTicker) {
                setGexSearchInput(targetTicker);
                fetchGexData(targetTicker);
              }
              setActiveTab('gexprofiler');
            } else if (tab === 'ask_ai') {
              setActiveTab('ask_ai');
            }
          }}
        />
      )}

      {activeTab === 'wyckoff' && (
        <WyckoffScreener />
      )}

      {activeTab === 'elliott_wave' && (
        <ElliottWaveScreener />
      )}

      {activeTab === 'gann' && (
        <GannScreener />
      )}

      {activeTab === 'stage_canslim' && (
        <StageCanslimScreener />
      )}

      {activeTab === 'zacks' && (
        <ZacksFundamentalReport initialTicker={expertTickerData?.ticker || searchQuery || 'NVDA'} />
      )}

      {activeTab === 'deepfundamentals' && (
        <DeepFundamentalsDashboard currentTicker={expertTickerData?.ticker || searchQuery || 'NVDA'} />
      )}

      {activeTab === 'earnings' && (
        <EarningsEvasionTracker 
          initialTicker={expertTickerData?.ticker || searchQuery || 'NVDA'} 
          onSelectTicker={fetchTickerData}
          onOpenFundamentals={(ticker) => {
            setSearchQuery(ticker);
            setActiveTab('deepfundamentals');
          }}
        />
      )}

      {activeTab === 'agents' && (
        <LiveAgentsDashboard initialTicker={searchQuery || 'NVDA'} />
      )}

      {activeTab === 'screenermonitor' && (
        <ScreenerMonitorDashboard onTickerClick={fetchTickerData} />
      )}

      {activeTab === 'swingsystem' && (
        <SwingTradingSystem 
          onSelectTicker={fetchTickerData} 
          onOpenFundamentals={(ticker) => {
            setSearchQuery(ticker);
            setActiveTab('deepfundamentals');
          }}
        />
      )}

      {activeTab === 'rslinescanner' && (
        <RsLineScanner onTickerClick={fetchTickerData} />
      )}

      {activeTab === 'analysis' && (
        <AiPlaybookDashboard onTickerClick={fetchTickerData} />
      )}

      {activeTab === 'squeeze' && (
        <SqueezeRadarDashboard
          squeezeData={squeezeData}
          isLoading={squeezeLoading}
          onTickerClick={fetchTickerData}
          onOpenFundamentals={(ticker) => {
            setDeepFundamentalsTicker(ticker);
            setActiveTab('deepfundamentals');
          }}
          onRefresh={() => {
            setSqueezeLoading(true);
            fetch('/api/squeeze/radar?refresh=1', { method: 'POST', cache: 'no-store' })
              .then((res) => res.json())
              .then((data) => setSqueezeData(data))
              .catch((err) => console.error('Error refreshing squeeze data:', err))
              .finally(() => setSqueezeLoading(false));
          }}
        />
      )}

      {activeTab === 'clean_uptrend' && (
        <CleanUptrendDashboard
          data={cleanUptrendData}
          onTickerClick={fetchTickerData}
          onOpenFundamentals={(ticker) => {
            setDeepFundamentalsTicker(ticker);
            setActiveTab('deepfundamentals');
          }}
          onRefresh={() => {
            fetch('/api/clean_uptrend_scanner?refresh=1', { method: 'POST' })
              .then((res) => (res.ok ? res.json() : fetch(`/clean_uptrend_results.json?t=${Date.now()}`, { cache: 'no-store' }).then((r) => r.json())))
              .then((fresh) => {
                if (fresh?.stocks) setCleanUptrendData(fresh);
              })
              .catch(() => {
                fetch(`/clean_uptrend_results.json?t=${Date.now()}`, { cache: 'no-store' })
                  .then((r) => r.json())
                  .then((fresh) => setCleanUptrendData(fresh))
                  .catch((err) => console.error('Error refreshing clean uptrend data:', err));
              });
          }}
        />
      )}

      {activeTab === 'seasonality' && (
        <SeasonalityRadarDashboard data={seasonalityData} onTickerClick={fetchTickerData} />
      )}

      {activeTab === 'screeners' && screenerData && (
        <ExpertScreenersHub
          screenerData={screenerData}
          cleanUptrendData={cleanUptrendData}
          emergingLeadersData={emergingLeadersData}
          bestActingData={bestActingData}
          wickAbsorptionData={wickAbsorptionData}
          deepvueData={deepvueData}
          realsimpleData={realsimpleData}
          firstMaPullbackData={firstMaPullbackData}
          screenerCategories={ScreenerCategories}
          screenerDescriptions={ScreenerDescriptions}
          onTickerClick={fetchTickerData}
          onOpenFundamentals={(tk) => {
            setDeepFundamentalsTicker(tk);
            setActiveTab('deepfundamentals');
          }}
          onRefreshAll={fetchAllData}
          onRefreshCleanUptrend={() => {
            fetch('/api/clean_uptrend_scanner?refresh=1', { method: 'POST' })
              .then((res) => (res.ok ? res.json() : fetchNoCache('/clean_uptrend_results.json').then((r) => r.json())))
              .then((fresh) => {
                if (fresh?.stocks) setCleanUptrendData(fresh);
              })
              .catch(() => {
                fetchNoCache('/clean_uptrend_results.json')
                  .then((r) => r.json())
                  .then((fresh) => setCleanUptrendData(fresh))
                  .catch((err) => console.error('Error refreshing clean uptrend data:', err));
              });
          }}
        />
      )}

      {/* Weekly Playbook Tab */}
      {activeTab === 'playbook' && (
        weeklyPlaybook ? (
          <WeeklyPlaybookDashboard 
            playbook={weeklyPlaybook} 
            onTickerClick={fetchTickerData} 
            onRefresh={(newData) => setWeeklyPlaybook(newData)}
          />
        ) : (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', marginTop: '2rem' }}>
            <h3 style={{ color: '#fff', fontSize: '1.4rem', margin: '0 0 0.5rem' }}>Loading Weekly Playbook 2.0...</h3>
            <p style={{ color: '#94a3b8' }}>Synthesizing macro regime, sector rotation, and Ross Haber stock personality models.</p>
          </div>
        )
      )}

      {/* Market Health & Macro Studio v3.0 */}
      {(activeTab === 'health' || activeTab === 'macromatrix') && (
        marketHealth ? (
          <div style={{ marginTop: '0.65rem' }}>
            <MarketHealthMacroStudio
              healthData={marketHealth}
              macroData={correlationData}
              cycle50yData={marketCycle50y}
              onRefreshHealth={(fresh) => setMarketHealth(fresh)}
              onRefreshMacro={(freshMacro) => setCorrelationData(freshMacro)}
              onRefreshCycle50y={(fresh50y) => setMarketCycle50y(fresh50y)}
              onTickerClick={fetchTickerData}
            />
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', marginTop: '1rem', color: '#94a3b8' }}>
            <h3 style={{ color: '#f8fafc', margin: '0 0 0.5rem 0' }}>Loading Market Health &amp; Macro Studio v3.0...</h3>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Synthesizing breadth internals, Zweig Thrust, VIX term structure, and cross-asset regimes.</p>
          </div>
        )
      )}

      {/* RRG Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <RrgMoneyFlowDashboard
          data={data}
          timeframe={timeframe}
          setTimeframe={setTimeframe}
          setModalData={setModalData}
          fetchTickerData={fetchTickerData}
          multiTimeframeFocusList={multiTimeframeFocusList}
          emergingLeadersList={emergingLeadersList}
        />
      )}

      {/* Sector Components Modal */}
      {modalData && (
        <div className="modal-overlay" onClick={() => setModalData(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <button className="modal-close" onClick={() => setModalData(null)}><X size={24} /></button>
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8' }}>
              <Activity /> {modalData.name} ({modalData.ticker})
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '-6px', marginBottom: '14px' }}>
              Click any component stock below to launch its Deep Institutional Chart & Stage Analysis.
            </p>
            <div className="top-stocks-grid" style={{ gridTemplateColumns: '1fr', gap: '0.65rem' }}>
              {modalData.top_stocks && modalData.top_stocks.length > 0 ? (
                modalData.top_stocks.map(stock => (
                  <div
                    key={stock.ticker}
                    className="stock-pill"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', cursor: 'pointer' }}
                    onClick={() => fetchTickerData(stock.ticker)}
                  >
                    <div>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc', fontSize: '0.95rem' }}>
                        {stock.ticker} <BarChart2 size={15} color="#38bdf8" />
                      </strong>
                      {stock.stage && (
                        <span style={{ fontSize: '0.73rem', color: stock.stage.includes('2') ? '#10b981' : '#94a3b8' }}>
                          {stock.stage} {stock.momentum_text ? `• ${stock.momentum_text}` : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      <div style={{ color: stock.perf > 0 ? '#10b981' : '#ef4444', fontWeight: 800, fontSize: '0.9rem' }}>
                        1D: {stock.perf > 0 ? '+' : ''}{Number(stock.perf || 0).toFixed(2)}%
                      </div>
                      {stock.rs_spy_1mo !== undefined && (
                        <div style={{ fontSize: '0.72rem', color: stock.rs_spy_1mo >= 0 ? '#38bdf8' : '#94a3b8' }}>
                          1M RS vs SPY: {stock.rs_spy_1mo >= 0 ? '+' : ''}{Number(stock.rs_spy_1mo || 0).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : <span>No component data available.</span>}
            </div>
          </div>
        </div>
      )}

      {/* Charting Engine (Center Pane) */}
      {activeTab === 'chart' && (
        <DeepChartingTerminal
          expertTickerData={expertTickerData}
          isSearching={isSearching}
          searchError={searchError}
          onSelectTicker={(sym) => fetchTickerData(sym)}
          dnaData={dnaData}
          loadingDna={loadingDna}
          onFetchDna={(sym) => fetchDNA(sym)}
        />
      )}

      {activeTab === 'intraday' && (
        <IntradayRadarDashboard
          intradayData={intradayData}
          loading={intradayLoading}
          onTickerClick={fetchTickerData}
          onOpenFundamentals={(ticker) => {
            setDeepFundamentalsTicker(ticker);
            setActiveTab('deepfundamentals');
          }}
          onRefresh={() => fetchIntradayAlerts(true)}
        />
      )}

      {/* Morning Briefing Tab */}
      {activeTab === 'briefing' && briefingData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem', borderTop: '5px solid #DFFF00' }}>
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#DFFF00' }}>
              <Sun size={24} /> Daily Morning Briefing
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '2rem' }}>
              Your pre-market breakdown of the top gap-up/down movers and macro catalysts.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <h3 style={{ color: '#f59e0b', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Top Pre-Market Movers</h3>
                {briefingData.top_movers && briefingData.top_movers.map((mover, i) => (
                  <div key={i} style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginBottom: '1rem', borderLeft: `4px solid ${mover.change && mover.change.startsWith('+') ? '#10b981' : '#ef4444'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '1.2rem', color: '#fff' }}>{mover.ticker}</strong>
                      <strong style={{ fontSize: '1.1rem', color: mover.change && mover.change.startsWith('+') ? '#10b981' : '#ef4444' }}>{mover.change}</strong>
                    </div>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', marginBottom: '10px' }}>{mover.reason}</p>
                    <button onClick={() => fetchTickerData(mover.ticker)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Search size={14} /> Analyze Setup
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <h3 style={{ color: '#4facfe', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Macro Catalysts (SPY)</h3>
                {briefingData.macro_news && briefingData.macro_news.map((news, i) => (
                  <div key={i} style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.95rem' }}>{news}</p>
                  </div>
                ))}
                
                <h3 style={{ color: '#ec4899', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginTop: '2rem' }}>Big Tech Earnings (QQQ)</h3>
                {briefingData.earnings && briefingData.earnings.map((news, i) => (
                  <div key={i} style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.95rem' }}>{news}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Ask AI Full-Screen Tab */}
      {activeTab === 'ask_ai' && (
        <AskAiLiveDashboard
          activeTicker={expertTickerData ? expertTickerData.ticker : searchQuery || 'SPY'}
          onTickerSelect={(t) => {
            fetchTickerData(t);
            setActiveTab('overview');
          }}
          initialPersona={agentPersona || 'master'}
        />
      )}
      
      </div> {/* End main-content */}

      {/* Right Pane (Live Agents & Sweeps Feed) - Foldable (Hidden on Deep Charting & Ask AI Live for full width) */}
      <div 
        className={`right-pane ${isLiveUpdatesFolded ? 'folded' : ''}`} 
        style={{ 
          display: (activeTab === 'chart' || activeTab === 'ask_ai') ? 'none' : 'flex',
          padding: isLiveUpdatesFolded ? '1rem 0.35rem' : '1.5rem',
          width: isLiveUpdatesFolded ? '52px' : '400px',
          minWidth: isLiveUpdatesFolded ? '52px' : '400px',
          boxSizing: 'border-box'
        }}
      >
        {isLiveUpdatesFolded ? (
          <div
            onClick={toggleLiveUpdates}
            title="Click to unfold Live Market Updates panel"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              cursor: 'pointer',
              padding: '0.75rem 0',
              userSelect: 'none',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '6px',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              transition: 'all 0.2s',
              gap: '12px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.6)'; e.currentTarget.style.background = 'rgba(15, 23, 42, 0.9)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.25)'; e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)'; }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); toggleLiveUpdates(); }}
              title="Unfold Live Market Updates"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#10b981',
                borderRadius: '4px',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <Radio size={18} className={streamStatus === 'live' ? 'pulse' : ''} style={{ color: streamStatus === 'live' ? '#10b981' : '#eab308' }} />
              {chatHistory.filter(m => m.isBroadcast).length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-10px',
                  fontSize: '0.62rem',
                  fontWeight: 'bold',
                  background: '#10b981',
                  color: '#000',
                  padding: '1px 4px',
                  borderRadius: '8px',
                  lineHeight: '1',
                  minWidth: '12px',
                  textAlign: 'center'
                }}>
                  {chatHistory.filter(m => m.isBroadcast).length}
                </span>
              )}
            </div>

            <div style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              transform: 'rotate(180deg)',
              color: '#94a3b8',
              fontSize: '0.72rem',
              fontWeight: '700',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              marginTop: '1.5rem'
            }}>
              <span style={{ color: '#10b981' }}>●</span> LIVE MARKET UPDATES
            </div>
          </div>
        ) : (
          /* Live Agent / Sweeps Feed - ALWAYS VISIBLE */
          <div className="neo-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
                  <Radio size={16} className={streamStatus === 'live' ? 'pulse' : ''} /> Live Market Updates
                </h3>
                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: streamStatus === 'live' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                  color: streamStatus === 'live' ? '#10b981' : '#eab308',
                  border: `1px solid ${streamStatus === 'live' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(234, 179, 8, 0.4)'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  textTransform: 'uppercase'
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: streamStatus === 'live' ? '#10b981' : '#eab308', display: 'inline-block' }} />
                  {streamStatus === 'live' ? 'LIVE' : 'SYNCED'}
                </span>
                {chatHistory.filter(m => m.isBroadcast).length > 0 && (
                  <span style={{ fontSize: '0.7rem', background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', padding: '1px 6px', borderRadius: '8px' }}>
                    {chatHistory.filter(m => m.isBroadcast).length}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {lastSyncTime && (
                  <span style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'monospace' }}>
                    {lastSyncTime}
                  </span>
                )}
                <button
                  onClick={() => {
                    setIsRefreshingAlerts(true);
                    fetch('/alerts.json?t=' + Date.now())
                      .then(r => r.json())
                      .then(alerts => {
                        if (Array.isArray(alerts)) {
                          const formatted = alerts.slice(0, 30).map(formatAlertMessage).filter(Boolean);
                          setChatHistory(prev => mergeAlerts(prev, formatted));
                          setLastSyncTime(new Date().toLocaleTimeString());
                        }
                      })
                      .finally(() => setTimeout(() => setIsRefreshingAlerts(false), 500));
                  }}
                  title="Sync latest live alerts"
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center' }}
                >
                  <RefreshCw size={13} style={{ transform: isRefreshingAlerts ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }} />
                </button>
                <button
                  onClick={toggleLiveUpdates}
                  title="Fold / Collapse Live Market Updates"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '3px 7px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.72rem',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)'; e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                >
                  <span>Fold</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px' }}>
              {chatHistory.filter(m => m.isBroadcast).length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
                  <Activity size={32} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0 }}>Connecting to live market radar feed...</p>
                </div>
              )}
              
              {chatHistory.filter(m => m.isBroadcast).map((msg, idx) => (
                <div key={msg.id || idx} style={{ alignSelf: 'flex-start', background: 'rgba(15, 23, 42, 0.65)', border: `1px solid ${msg.color || '#3b82f6'}`, padding: '10px 12px', borderRadius: '8px', width: '100%', boxSizing: 'border-box', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <strong style={{ color: msg.color, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
                      {msg.council || '⚡ MARKET RADAR'}
                    </strong>
                    {msg.timeStr && (
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {msg.timeStr}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ margin: 0, fontSize: '0.82rem', color: '#e2e8f0', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                    <ReactMarkdown>{(msg.text || '').replace(/\*/g, '**')}</ReactMarkdown>
                  </div>
                  
                  {msg.payload ? (
                    <button 
                      onClick={() => { setBriefingData(msg.payload); setActiveTab('briefing'); }}
                      style={{ marginTop: '8px', padding: '6px 12px', background: '#DFFF00', color: '#000', border: 'none', borderRadius: '4px', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', width: '100%', justifyContent: 'center' }}
                    >
                      <Maximize size={13} /> Expand Morning Briefing
                    </button>
                  ) : (
                    msg.ticker && !['MARKET', 'MACRO', 'UNKNOWN', 'BRIEFING'].includes(msg.ticker) && (
                      <button 
                        onClick={() => fetchTickerData(msg.ticker)}
                        style={{ marginTop: '8px', padding: '4px 10px', background: 'rgba(255,255,255,0.05)', color: msg.color, border: `1px solid ${msg.color}`, borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}
                      >
                        <Search size={12} /> Analyze {msg.ticker}
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div> {/* End app-layout */}
    </>
  )
}

export default App
