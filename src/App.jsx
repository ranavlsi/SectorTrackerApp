import React, { useState, useEffect, useMemo, useRef } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend, Cell, ComposedChart, Line, Bar, Area, LabelList } from 'recharts'
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw, ChevronDown, ChevronUp, FileText, Activity, Filter, X, BarChart2, ActivitySquare, Compass, Search, Loader, Crosshair, Radio, HeartPulse, Maximize, Minimize, Send, Bot, User, Sun, BookOpen, Zap, Link, Star, List, CheckCircle2, Info, ShieldAlert, ShieldCheck, Target, Landmark, Waves, Flame, Rocket } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import CustomTradingChart from './CustomTradingChart'
import UnifiedPlotlyChart from './UnifiedPlotlyChart'
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
import { MarketHealthGuideCard, MarketHealthRadarMatrix, RegimePlaybookCard } from './MarketHealthGuideCard';
import { StockPersonalityBadge, RossHaberPersonalityPanel } from './StockPersonalityBadge';
import WeeklyPlaybookDashboard from './WeeklyPlaybookDashboard';
import SeasonalityRadarDashboard from './SeasonalityRadarDashboard';
import MacroMatrixDashboard from './MacroMatrixDashboard';
import AiPlaybookDashboard from './AiPlaybookDashboard';
import AskAiLiveDashboard from './AskAiLiveDashboard';
import SwingTradingSystem from './SwingTradingSystem';
import OptionsIntelligenceScreener from './OptionsIntelligenceScreener';
import WyckoffScreener from './WyckoffScreener';
import ElliottWaveScreener from './ElliottWaveScreener';
import GannScreener from './GannScreener';
import StageCanslimScreener from './StageCanslimScreener';
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
    Object.keys(ScreenerCategories).reduce((acc, key) => ({ ...acc, [key]: true }), {})
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
  
  // Squeeze State
  const [squeezeData, setSqueezeData] = useState(null)
  
  // Seasonality Radar State
  const [seasonalityData, setSeasonalityData] = useState(null)
  
  // DeepVue State
  const [deepvueData, setDeepvueData] = useState(null)
  
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
      const res = await fetch(`/api/dna?ticker=${ticker}`);
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
  
  // Global Live Alerts State
  const [globalLiveAlerts, setGlobalLiveAlerts] = useState([])

  useEffect(() => {
    const fetchAllData = () => {
      fetch('/sector_flow.json?t=' + new Date().getTime())
        .then(res => res.json())
        .then(json => setData(json))
        .catch(err => console.error("Error fetching data:", err))
        
      fetch('/screener_results.json?t=' + new Date().getTime())
        .then(res => res.json())
        .then(data => setScreenerData(data))
        .catch(err => console.error("Error loading screener data:", err))
        
      fetch('/market_health.json?t=' + new Date().getTime())
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then(text => {
          const sanitized = text.replace(/:\s*NaN\b/g, ': null').replace(/:\s*undefined\b/g, ': null');
          const data = JSON.parse(sanitized);
          setMarketHealth(data);
        })
        .catch(err => {
          console.warn("Retrying market health from API fallback...", err);
          fetch('/api/market_health')
            .then(r => r.json())
            .then(data => {
              if (data && !data.error) setMarketHealth(data);
            })
            .catch(apiErr => console.error("Error loading market health data:", apiErr));
        })

      fetch('/weekly_playbook.json?t=' + new Date().getTime())
        .then(res => res.json())
        .then(data => setWeeklyPlaybook(data))
        .catch(err => {
          console.warn("Retrying weekly playbook from API fallback...", err);
          fetch('/api/weekly_playbook')
            .then(r => r.json())
            .then(data => {
              if (data && !data.error) setWeeklyPlaybook(data);
            })
            .catch(apiErr => console.error("Error loading weekly playbook:", apiErr));
        })
        
      fetch('/squeeze_results.json?t=' + new Date().getTime())
        .then(res => res.json())
        .then(data => setSqueezeData(data))
        .catch(err => console.error("Error loading squeeze data:", err))
        
      fetch('/seasonality_results.json?t=' + new Date().getTime())
        .then(res => res.json())
        .then(data => setSeasonalityData(data))
        .catch(err => console.error("Error loading seasonality data:", err))
        
      fetch('/deepvue_results.json?t=' + new Date().getTime())
        .then(res => res.json())
        .then(data => setDeepvueData(data))
        .catch(err => console.error("Error loading deepvue data:", err))
        
      fetch('/correlation_results.json?t=' + new Date().getTime())
        .then(res => res.json())
        .then(data => setCorrelationData(data))
        .catch(err => console.error("Error loading correlation data:", err))

      fetch('/ai_playbook.md?t=' + new Date().getTime())
        .then(res => res.text())
        .then(text => setPlaybookContent(text))
        .catch(err => console.error("Error loading playbook:", err))
        
      fetch('/intraday_results.json?t=' + new Date().getTime())
        .then(res => res.json())
        .then(json => setIntradayData(json.results || []))
        .catch(err => console.error("Error loading intraday data:", err))
      fetch('/alerts.json?t=' + Date.now())
        .then(res => res.json())
        .then(alerts => {
          if (Array.isArray(alerts) && alerts.length > 0) {
            const formatted = alerts.map(formatAlertMessage).filter(Boolean);
            setChatHistory(prev => mergeAlerts(prev, formatted));
            setLastSyncTime(new Date().toLocaleTimeString());
          }
        })
        .catch(err => console.debug("Initial alerts history load skipped:", err));
    };

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
    const freshMoney = [];
    const profitTaking = [];
    const deadMoney = [];

    rrgData.forEach(sec => {
      if (!sec.trail || sec.trail.length === 0) return;
      const current = sec.trail[sec.trail.length - 1];
      // Look back a few periods for direction
      const prev = sec.trail.length > 3 ? sec.trail[sec.trail.length - 3] : sec.trail[0];

      const isImproving = current.x < 100 && current.y >= 100;
      const isLeading = current.x >= 100 && current.y >= 100;
      const isWeakening = current.x >= 100 && current.y < 100;
      const isLagging = current.x < 100 && current.y < 100;

      const momRising = current.y > prev.y;
      
      const rank = tableData.findIndex(s => s.name === sec.name) + 1;
      const sectorObj = { name: sec.name, rank, improving: momRising };
      
      // 1. Fresh Money / Leaders (Aggressive rotation IN or Current Leaders)
      if (isLeading || (isImproving && momRising)) {
        freshMoney.push(sectorObj);
      } 
      // 2. Profit Taking (Rotation OUT)
      else if (isWeakening) {
        profitTaking.push(sectorObj);
      } 
      // 3. Dead Money (Trapped, or Failed Breakouts)
      else if (isLagging || (isImproving && !momRising)) {
        deadMoney.push(sectorObj);
      }
    });
    // Sort all arrays by rank (ascending, so #1 is first)
    freshMoney.sort((a, b) => a.rank - b.rank);
    profitTaking.sort((a, b) => a.rank - b.rank);
    // Dead money sorted descending (so highest rank number/worst sector is first)
    deadMoney.sort((a, b) => b.rank - a.rank);

    return { freshMoney, profitTaking, deadMoney };
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
    setIsSearching(true);
    setSearchError(null);
    setExpertTickerData(null);
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
  
  const fetchIntradayAlerts = async () => {
    setActiveTab('intraday');
    setIntradayLoading(true);
    try {
      const res = await fetch(`/intraday_results.json?t=` + new Date().getTime());
      const json = await res.json();
      setIntradayData(json.results || []);
    } catch (err) {
      console.error(err);
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
          <button className={activeTab === 'screenermonitor' ? 'tab-active' : ''} onClick={() => setActiveTab('screenermonitor')}><Target size={18} /> Screener Monitor 🎯</button>
          <button 
            className={activeTab === 'swingsystem' ? 'tab-active' : ''} 
            onClick={() => setActiveTab('swingsystem')}
            style={{
              background: activeTab === 'swingsystem' ? undefined : 'rgba(0, 242, 254, 0.08)',
              borderLeft: activeTab === 'swingsystem' ? undefined : '3px solid #00f2fe',
              color: activeTab === 'swingsystem' ? undefined : '#00f2fe',
              fontWeight: 700
            }}
          >
            <Target size={18} color="#00f2fe" /> 1-3W Swing System 🎯
          </button>
          <button className={activeTab === 'gexprofiler' ? 'tab-active' : ''} onClick={() => setActiveTab('gexprofiler')}><BarChart2 size={18} /> GEX Profiler</button>
          <button className={activeTab === 'health' ? 'tab-active' : ''} onClick={() => setActiveTab('health')}><HeartPulse size={18} /> Market Health</button>
          <button className={activeTab === 'playbook' ? 'tab-active' : ''} onClick={() => setActiveTab('playbook')}><BookOpen size={18} /> Weekly Playbook</button>
          <button className={activeTab === 'squeeze' ? 'tab-active' : ''} onClick={() => setActiveTab('squeeze')}><AlertCircle size={18} /> Squeeze Radar</button>
          <button className={activeTab === 'seasonality' ? 'tab-active' : ''} onClick={() => setActiveTab('seasonality')}><Compass size={18} /> Seasonality Radar</button>
          <button className={activeTab === 'intraday' ? 'tab-active' : ''} onClick={fetchIntradayAlerts}><Radio size={18} /> Intraday Radar</button>
          <button className={activeTab === 'macromatrix' ? 'tab-active' : ''} onClick={() => setActiveTab('macromatrix')}><ActivitySquare size={18} /> Macro Matrix</button>
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
      <div className="main-content">
        {/* Top Navbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #1e293b' }}>
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

          {marketMeter && (
            <div className="glass-card" style={{ padding: '0.5rem 1rem', borderLeft: `4px solid ${marketMeter.color}`, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Compass size={18} color={marketMeter.color} />
              <strong style={{ margin: 0, color: marketMeter.color, fontSize: '0.9rem' }}>Market Trend: {marketMeter.status}</strong>
            </div>
          )}
        </div>

        {/* Global Intraday Live Alerts Ticker */}
        {globalLiveAlerts.length > 0 && (
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
          </div>
        )}

      {activeTab === 'tvsync' && (
        <TradingViewSync />
      )}

      {activeTab === 'macromatrix' && (
        <MacroMatrixDashboard data={correlationData} onTickerClick={fetchTickerData} />
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
                      setSearchedGex({ ticker: sym });
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

            <form onSubmit={(e) => { e.preventDefault(); if (gexSearch) setSearchedGex({ticker: gexSearch.toUpperCase()}); }} style={{ display: 'flex', gap: '0.75rem' }}>
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

          <VolatilitySurface3D ticker={(searchedGex?.ticker) || expertTickerData?.ticker || 'SPY'} />
        </div>
      )}

      {activeTab === 'options_screener' && (
        <OptionsIntelligenceScreener 
          onNavigateTab={(tab, targetTicker) => {
            if (tab === 'volsurface') {
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
        <EarningsEvasionTracker initialTicker={searchQuery || 'NVDA'} />
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
        <div className="glass-card" style={{ padding: '2rem' }}>
            <RsLineScanner onTickerClick={fetchTickerData} />
        </div>
      )}

      {activeTab === 'analysis' && (
        <AiPlaybookDashboard onTickerClick={fetchTickerData} />
      )}

      {activeTab === 'squeeze' && squeezeData && (
        <div>
          <h2 style={{ marginBottom: '2rem' }}>🔥 Short Squeeze Radar</h2>
          
          {squeezeData.squeeze_started && squeezeData.squeeze_started.length > 0 && (
            <div className="glass-card flash-alert" style={{ padding: '2rem', marginBottom: '2rem', border: '2px solid #ef4444' }}>
              <h2 style={{ color: '#ef4444', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle /> SQUEEZE TRIGGERED!
              </h2>
              <p style={{ color: '#f87171' }}>These highly shorted stocks are experiencing massive price spikes and aggressive Call buying right now.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                {squeezeData.squeeze_started.map(item => (
                  <ScreenerPill key={item.ticker} item={item} onClick={() => fetchTickerData(item.ticker)} />
                ))}
              </div>
            </div>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid #f59e0b' }}>
              <h3 style={{ marginTop: 0, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ActivitySquare /> Gamma Squeeze Setup
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>High short interest + Unusual Options Call Volume</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                {squeezeData.gamma_squeeze_setup && squeezeData.gamma_squeeze_setup.length > 0 ? (
                  squeezeData.gamma_squeeze_setup.map(item => (
                    <ScreenerPill key={item.ticker} item={item} onClick={() => fetchTickerData(item.ticker)} />
                  ))
                ) : <span style={{ color: '#64748b' }}>None currently detected.</span>}
              </div>
            </div>
            
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid #4facfe' }}>
              <h3 style={{ marginTop: 0, color: '#4facfe', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp /> Heavily Shorted Watchlist
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Top stocks with &gt; 5% Float Short or &gt; 3 Days to Cover</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                {squeezeData.high_short_interest && squeezeData.high_short_interest.length > 0 ? (
                  squeezeData.high_short_interest.map(item => (
                    <ScreenerPill key={item.ticker} item={item} onClick={() => fetchTickerData(item.ticker)} />
                  ))
                ) : <span style={{ color: '#64748b' }}>None currently detected.</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'seasonality' && (
        <SeasonalityRadarDashboard data={seasonalityData} onTickerClick={fetchTickerData} />
      )}

      {activeTab === 'screeners' && screenerData && (
        <div>
          <h2 style={{ marginBottom: '2rem' }}>Algorithmic Technical Setups</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'start', marginBottom: '2rem' }}>
            {/* DeepVue Quantitative Leaders Card */}
            {deepvueData && deepvueData.leaders && (
              <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
                <h3 
                  style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#ffd700', cursor: 'pointer' }}
                  onClick={() => setCollapsedCategories(prev => ({ ...prev, deepvue: !prev.deepvue }))}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Zap size={18} /> TraderLion / DeepVue Leaders</span>
                  {collapsedCategories.deepvue ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </h3>
                
                {!collapsedCategories.deepvue && (
                  <>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem', marginTop: '0.5rem' }}>
                      S.N.I.P Matrix: RS Rating &gt; 80, VCP, Earnings Growth &gt; 15%
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {deepvueData.leaders.slice(0, expandedCategories.deepvue_leaders ? 20 : 5).map(item => (
                        <ScreenerPill 
                          key={item.ticker} 
                          item={{
                            ticker: item.ticker,
                            metric: `RS Rank ${item.rs_rating} ${item.vcp_setup ? '🔥(VCP)' : ''}`
                          }} 
                          onClick={() => fetchTickerData(item.ticker)} 
                        />
                      ))}
                      {deepvueData.leaders.length > 5 && (
                        <button 
                          onClick={() => setExpandedCategories(prev => ({ ...prev, deepvue_leaders: !prev.deepvue_leaders }))}
                          style={{ 
                            background: 'rgba(255, 215, 0, 0.05)', 
                            border: '1px dashed rgba(255, 215, 0, 0.3)', 
                            color: '#ffd700', 
                            padding: '0.5rem', 
                            borderRadius: '4px', 
                            cursor: 'pointer', 
                            marginTop: '0.5rem',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          {expandedCategories.deepvue_leaders ? (
                            <><ChevronUp size={16} /> Fold Up</>
                          ) : (
                            <><ChevronDown size={16} /> View {Math.min(20, deepvueData.leaders.length)} / {deepvueData.leaders.length} Leaders</>
                          )}
                        </button>
                      )}
                    </div>

                    {deepvueData.active_vcp && deepvueData.active_vcp.length > 0 && (
                      <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 215, 0, 0.15)' }}>
                        <h4 style={{ color: '#ffd700', marginTop: 0, marginBottom: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Crosshair size={14} /> Tightly Coiled (VCP)
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {deepvueData.active_vcp.slice(0, expandedCategories.deepvue_vcp ? 20 : 5).map(item => (
                            <ScreenerPill 
                              key={`vcp-${item.ticker}`} 
                              item={{
                                ticker: item.ticker,
                                metric: `RS Rank ${item.rs_rating}`
                              }} 
                              onClick={() => fetchTickerData(item.ticker)} 
                            />
                          ))}
                          {deepvueData.active_vcp.length > 5 && (
                            <button 
                              onClick={() => setExpandedCategories(prev => ({ ...prev, deepvue_vcp: !prev.deepvue_vcp }))}
                              style={{ 
                                background: 'rgba(255, 215, 0, 0.05)', 
                                border: '1px dashed rgba(255, 215, 0, 0.3)', 
                                color: '#ffd700', 
                                padding: '0.5rem', 
                                borderRadius: '4px', 
                                cursor: 'pointer', 
                                marginTop: '0.5rem',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              {expandedCategories.deepvue_vcp ? (
                                <><ChevronUp size={16} /> Fold Up</>
                              ) : (
                                <><ChevronDown size={16} /> View {Math.min(20, deepvueData.active_vcp.length)} / {deepvueData.active_vcp.length} VCP Setups</>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            
            {/* Standard Algorithmic Setups */}
            {Object.entries(ScreenerCategories).map(([key, config]) => (
              <div key={key} className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 
                  style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', cursor: 'pointer' }}
                  onClick={() => setCollapsedCategories(prev => ({ ...prev, [key]: !prev[key] }))}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{config.icon} {config.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Info 
                      size={18} 
                      color="rgba(255,255,255,0.4)" 
                      style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#4facfe'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                      onClick={(e) => {
                          e.stopPropagation();
                          setInfoVisible(prev => ({ ...prev, [key]: !prev[key] }));
                      }} 
                    />
                    {expandedCategories[key] && !collapsedCategories[key] && (
                        <span 
                            style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(79, 172, 254, 0.15)', color: '#4facfe', borderRadius: '12px', border: '1px solid #4facfe' }}
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setExpandedCategories(prev => ({ ...prev, [key]: false })); 
                            }}
                        >
                            Fold Up
                        </span>
                    )}
                    {collapsedCategories[key] ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  </div>
                </h3>
                
                {infoVisible[key] && (
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1rem', borderLeft: '3px solid #4facfe' }}>
                    {ScreenerDescriptions[key] || config.desc}
                  </div>
                )}
                
                {!collapsedCategories[key] && (
                  screenerData[key] && screenerData[key].length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                      {screenerData[key]
                        .slice(0, expandedCategories[key] ? 20 : 5)
                        .map((item, idx) => (
                        <ScreenerPill key={item.ticker} item={item} rank={idx + 1} onClick={() => fetchTickerData(item.ticker)} />
                      ))}
                      {screenerData[key].length > 5 && (
                        <button 
                          onClick={() => setExpandedCategories(prev => ({ ...prev, [key]: !prev[key] }))}
                          style={{ 
                            background: 'rgba(79, 172, 254, 0.05)', 
                            border: '1px dashed rgba(79, 172, 254, 0.3)', 
                            color: '#4facfe', 
                            padding: '0.5rem', 
                            borderRadius: '4px', 
                            cursor: 'pointer', 
                            marginTop: '0.5rem',
                            transition: 'all 0.2s',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(79, 172, 254, 0.15)'; e.currentTarget.style.borderColor = '#4facfe'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(79, 172, 254, 0.05)'; e.currentTarget.style.borderColor = 'rgba(79, 172, 254, 0.3)'; }}
                        >
                          {expandedCategories[key] ? (
                            <><ChevronUp size={16}/> Fold Up</>
                          ) : (
                            <><ChevronDown size={16}/> Show Next 15 Stocks (Rank 6-20)</>
                          )}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: '#64748b', fontStyle: 'italic', marginTop: '1rem' }}>No setups found today.</p>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
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

      {/* Market Health Dashboard Tab */}
      {activeTab === 'health' && marketHealth && (
        <div style={{ marginTop: '2rem' }}>
          {/* Master Health Card */}
          <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', textAlign: 'center', borderTop: `5px solid ${marketHealth.current_health.score_value >= 60 ? '#10b981' : marketHealth.current_health.score_value <= 40 ? '#ef4444' : '#f59e0b'}` }}>
            <h2 style={{ fontSize: '1.5rem', margin: '0', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Aggregate Market Health Score</h2>
            <h1 style={{ fontSize: '4rem', margin: '0.5rem 0 0 0', color: marketHealth.current_health.score_value >= 60 ? '#10b981' : marketHealth.current_health.score_value <= 40 ? '#ef4444' : '#f59e0b' }}>
              {marketHealth.current_health.score_value} <span style={{fontSize: '2rem', color: '#64748b'}}>/ 100</span>
            </h1>
            <h3 style={{ fontSize: '1.2rem', margin: '0.5rem 0 2rem 0', color: '#fff' }}>Status: {marketHealth.current_health.score_label}</h3>
            
            <div style={{ background: 'rgba(15,23,42,0.5)', padding: '1.5rem', borderRadius: '12px', textAlign: 'left', borderLeft: '4px solid #3b82f6' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#60a5fa', fontSize: '1.1rem' }}>Council Summary Briefing</h4>
              {marketHealth.current_health.summary_text ? (
                 marketHealth.current_health.summary_text.split(/\r?\n|\\n/).map((line, i) => (
                    <p key={i} style={{ margin: '0.5rem 0', color: '#e2e8f0', lineHeight: '1.5' }}>
                      {line.replace(/\*\*/g, '').replace(/\\*\\*/g, '')}
                    </p>
                 ))
              ) : null}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>McClellan Oscillator</span>
                <h3 style={{ margin: '0.5rem 0 0 0', color: marketHealth.current_health.mco_value > 0 ? '#10b981' : '#ef4444' }}>{marketHealth.current_health.mco_value} ({marketHealth.current_health.mco_status})</h3>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Breadth (% &gt; 50 SMA)</span>
                <h3 style={{ margin: '0.5rem 0 0 0', color: marketHealth.current_health.pct_above_50_value > 50 ? '#10b981' : '#ef4444' }}>{marketHealth.current_health.pct_above_50_value}% ({marketHealth.current_health.breadth_status})</h3>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>A/D Momentum</span>
                <h3 style={{ margin: '0.5rem 0 0 0', color: marketHealth.current_health.ad_momentum.includes('Bullish') ? '#10b981' : '#ef4444' }}>{marketHealth.current_health.ad_momentum}</h3>
              </div>
            </div>
          </div>

          {/* Regime Rules of Engagement Playbook */}
          <RegimePlaybookCard currentRegime={marketHealth.current_health.health_regime || (marketHealth.current_health.score_value >= 60 ? 'RISK_ON' : marketHealth.current_health.score_value <= 40 ? 'RISK_OFF' : 'CAUTIOUS')} />

          {/* 9-Factor Executive Health Matrix */}
          <MarketHealthRadarMatrix healthData={marketHealth} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
            
            {/* Global Gradients */}
            <svg style={{ height: 0, position: 'absolute' }}>
              <defs>
                <linearGradient id="colorSpy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorBreadth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="healthColorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={1}/> {/* Risk-On >= 60 */}
                  <stop offset="40%" stopColor="#10b981" stopOpacity={1}/>
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity={1}/> {/* Cautious 40-59 */}
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity={1}/>
                  <stop offset="65%" stopColor="#ef4444" stopOpacity={1}/> {/* Risk-Off < 40 */}
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={1}/>
                </linearGradient>
              </defs>
            </svg>

            {/* Chart 1: Master Composite Market Health Oscillator */}
            <MarketHealthGuideCard
              icon={Activity}
              title="Master Composite Health Oscillator (0-100)"
              subtitle="Multi-Factor Synthesis of Breadth, Momentum, Volatility & Credit"
              badges={[
                { label: 'Score', value: `${marketHealth.current_health.score_value}/100`, color: marketHealth.current_health.health_regime_color || '#f59e0b' },
                { label: '5D Trend', value: `${(marketHealth.current_health.score_5d_delta || 0) > 0 ? '+' : ''}${marketHealth.current_health.score_5d_delta || 0} pts`, color: (marketHealth.current_health.score_5d_delta || 0) >= 0 ? '#10b981' : '#ef4444' }
              ]}
              biasLabel={marketHealth.current_health.health_regime === 'RISK_ON' ? 'RISK-ON (BULLISH)' : marketHealth.current_health.health_regime === 'CAUTIOUS' ? 'CAUTIOUS (CHOPPY)' : 'RISK-OFF (DEFENSIVE)'}
              biasColor={marketHealth.current_health.health_regime_color || '#f59e0b'}
              cardBorderColor={`${marketHealth.current_health.health_regime_color || '#f59e0b'}40`}
              algoInsight={marketHealth.current_health.chart_observations?.oscillator || `Composite Health Oscillator is at ${marketHealth.current_health.score_value}/100.`}
              whatItMeasures="A multi-factor quantitative macro synthesis combining 5 uncorrelated market health engines: McClellan Breadth Velocity, % Stocks above 50 SMA, 10-day New High/Low Differential, VIX Forward Skew, and HYG/IEF Credit Z-Scores. Normalized via rolling sigmoid transformation to eliminate single-factor false positives."
              benchmarks={[
                { level: '≥ 60', meaning: 'Risk-On: Broad institutional accumulation across sectors.', color: '#10b981' },
                { level: '40 - 59', meaning: 'Cautious: Mixed internals, selective rotation, range chop.', color: '#f59e0b' },
                { level: '< 40', meaning: 'Risk-Off: Internal breakdown, capital preservation mode.', color: '#ef4444' },
                { level: '< 20', meaning: 'Capitulation: Structural panic; multi-month bottoms form.', color: '#ec4899' },
                { level: '> 80', meaning: 'Euphoria / Overextended: Climax buying exhaustion.', color: '#38bdf8' }
              ]}
              playbook={[
                'Risk-On (≥ 60): Deploy 80-100% capital into leading breakouts, VCPs, and high-RS momentum stocks.',
                'Cautious (40-59): Reduce exposure to 40-60%. Take quick profits into strength; demand tight multi-week bases.',
                'Risk-Off (< 40): Hold 60-100% cash. Cease buying new breakouts (breakout failure rate exceeds 70%). Tighten trailing stops.',
                'Washout (< 20): Prepare buy watchlists for capitulation reversals when MCO hooks up from < -350.'
              ]}
            >
              <div style={{ height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={marketHealth.historical_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b'}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" stroke="#64748b" tick={{fill: '#64748b'}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{fill: '#f59e0b'}} domain={[0, 100]} axisLine={false} tickLine={false} />
                    
                    {/* Regime Zone Reference Areas */}
                    <ReferenceArea yAxisId="right" y1={60} y2={100} fill="#10b981" fillOpacity={0.06} />
                    <ReferenceArea yAxisId="right" y1={40} y2={60} fill="#f59e0b" fillOpacity={0.05} />
                    <ReferenceArea yAxisId="right" y1={0} y2={40} fill="#ef4444" fillOpacity={0.07} />
                    
                    <ReferenceLine y={60} yAxisId="right" stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.6} label={{ position: 'right', value: 'Risk-On (60)', fill: '#10b981', fontSize: 10 }} />
                    <ReferenceLine y={40} yAxisId="right" stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.6} label={{ position: 'right', value: 'Risk-Off (40)', fill: '#ef4444', fontSize: 10 }} />
                    
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} 
                      formatter={(val, name, item) => {
                        if (name === 'Composite Health') {
                          const state = item.payload.health_label || (val >= 60 ? 'Risk-On' : val >= 40 ? 'Cautious' : 'Risk-Off');
                          return [`${val}/100 [${state}]`, name];
                        }
                        if (name === 'SPY Price') return [`$${val.toFixed(2)}`, name];
                        return [val, name];
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Area yAxisId="left" type="monotone" dataKey="spy" name="SPY Price" stroke="#94a3b8" fillOpacity={1} fill="url(#colorSpy)" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="health_oscillator" name="Composite Health" stroke="url(#healthColorGradient)" strokeWidth={4} dot={{ r: 3, fill: marketHealth.current_health.health_regime_color || '#f59e0b', strokeWidth: 0 }} style={{ filter: 'drop-shadow(0px 0px 8px rgba(245, 158, 11, 0.6))' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </MarketHealthGuideCard>

            {/* Grid for Dual Charts (MCO & % > 50 SMA) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '2rem' }}>
              
              {/* Chart 2: McClellan Oscillator (MCO) */}
              <MarketHealthGuideCard
                icon={TrendingUp}
                title="McClellan Oscillator (MCO) & SPY Signals"
                subtitle="19-EMA vs 39-EMA Net Advances Velocity with Algorithmic Entry Signals"
                badges={[
                  { label: 'MCO', value: marketHealth.current_health.mco_value, color: marketHealth.current_health.mco_value > 0 ? '#10b981' : '#ef4444' },
                  { label: '5D Delta', value: `${(marketHealth.current_health.mco_5d_delta || 0) > 0 ? '+' : ''}${marketHealth.current_health.mco_5d_delta || 0}`, color: (marketHealth.current_health.mco_5d_delta || 0) >= 0 ? '#10b981' : '#ef4444' },
                  ...(marketHealth.current_health.latest_signal ? [{ label: 'Latest Signal', value: `${marketHealth.current_health.latest_signal.signal}: ${marketHealth.current_health.latest_signal.type}`, color: marketHealth.current_health.latest_signal.signal === 'BUY' ? '#10b981' : '#ef4444', bg: marketHealth.current_health.latest_signal.signal === 'BUY' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }] : [])
                ]}
                biasLabel={marketHealth.current_health.mco_status}
                biasColor={marketHealth.current_health.mco_value > 300 ? '#f59e0b' : marketHealth.current_health.mco_value > 0 ? '#10b981' : marketHealth.current_health.mco_value < -300 ? '#ef4444' : '#64748b'}
                algoInsight={marketHealth.current_health.chart_observations?.mco || `McClellan Oscillator is at ${marketHealth.current_health.mco_value}.`}
                whatItMeasures="Difference between 19-day EMA and 39-day EMA of Net Advancing stocks (Advances - Declines). Serves as the market's speedometer: positive values indicate accelerating upside velocity, while negative values indicate broadening liquidation."
                benchmarks={[
                  { level: '> +300 / +500', meaning: 'Overbought / Extreme OB: Climax buying thrust.', color: '#f59e0b' },
                  { level: '0 Line', meaning: 'Equilibrium: Above 0 is breadth expansion; below 0 is distribution.', color: '#64748b' },
                  { level: '< -300', meaning: 'Oversold: Downside selling velocity slowing.', color: '#ef4444' },
                  { level: '< -500', meaning: 'Extreme Capitulation: 5th percentile panic washout (77.1% SPY Buy Zone).', color: '#10b981' }
                ]}
                playbook={[
                  '▲ BUY: Oversold Reversal (< -350 hook up) boasts 77.1% 20D SPY win rate; buy index calls or high-RS setups.',
                  '▲ BUY: Bullish Zero Cross (> 0 after washout) confirms institutional breadth thrust; add to winning longs.',
                  '▼ SELL: Overbought Rollover (> +350 rollover) marks climax exhaustion; trim into strength and trail tight stops.',
                  '▼ SELL: Bearish Zero Cross (< 0) confirms distribution; cut lagging positions and hedge.'
                ]}
              >
                <div style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="mco" stroke="#64748b" tick={{fill: '#64748b', fontSize: 11}} domain={[-900, 700]} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="spy" orientation="right" stroke="#94a3b8" tick={{fill: '#94a3b8', fontSize: 11}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div style={{ background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(255,255,255,0.15)', padding: '10px 14px', borderRadius: '8px', minWidth: '180px' }}>
                                <p style={{ margin: '0 0 6px 0', color: '#94a3b8', fontSize: '0.8rem' }}>{data.date}</p>
                                <p style={{ margin: '0 0 4px 0', color: data.mco >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                                  MCO: {data.mco}
                                </p>
                                <p style={{ margin: '0 0 4px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                                  SPY: ${data.spy?.toFixed(2)}
                                </p>
                                {data.mco_signal && (
                                  <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <span style={{ 
                                      display: 'inline-block',
                                      padding: '2px 8px', 
                                      borderRadius: '4px', 
                                      fontSize: '0.75rem', 
                                      fontWeight: 'bold',
                                      background: data.mco_signal === 'BUY' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                      color: data.mco_signal === 'BUY' ? '#10b981' : '#ef4444',
                                      border: `1px solid ${data.mco_signal === 'BUY' ? '#10b981' : '#ef4444'}`
                                    }}>
                                      {data.mco_signal}: {data.mco_signal_type}
                                    </span>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#cbd5e1' }}>
                                      {data.mco_signal_note}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />

                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: '8px' }} />
                      
                      {/* Zero Line */}
                      <ReferenceLine yAxisId="mco" y={0} stroke="#475569" strokeWidth={2} />

                      {/* Institutional Overbought Thresholds */}
                      <ReferenceLine yAxisId="mco" y={300} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Overbought (+300)', fill: '#f59e0b', fontSize: 9 }} />
                      <ReferenceLine yAxisId="mco" y={500} stroke="#ef4444" strokeDasharray="2 2" strokeOpacity={0.7} label={{ position: 'insideTopLeft', value: 'Extreme OB (+500)', fill: '#ef4444', fontSize: 9 }} />
                      
                      {/* Institutional Oversold Thresholds */}
                      <ReferenceLine yAxisId="mco" y={-300} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', value: 'Oversold (-300)', fill: '#10b981', fontSize: 9 }} />
                      <ReferenceLine yAxisId="mco" y={-500} stroke="#059669" strokeDasharray="2 2" strokeOpacity={0.7} label={{ position: 'insideBottomLeft', value: 'Extreme OS (-500)', fill: '#34d399', fontSize: 9 }} />
                      
                      {/* SPY Comparison Line on Secondary Axis */}
                      <Line yAxisId="spy" type="monotone" dataKey="spy" name="SPY Price" stroke="#64748b" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                      
                      {/* MCO Histogram Bars */}
                      <Bar yAxisId="mco" dataKey="mco" name="McClellan Oscillator" radius={[2, 2, 0, 0]}>
                        {marketHealth.historical_data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.mco > 0 ? '#10b981' : '#ef4444'} fillOpacity={entry.mco_signal ? 1.0 : 0.65} />
                        ))}
                      </Bar>

                      {/* Buy Signals */}
                      <Line 
                        yAxisId="mco" 
                        type="monotone" 
                        dataKey={(d) => d.mco_signal === 'BUY' ? d.mco : null} 
                        name="▲ BUY Signal" 
                        stroke="#10b981" 
                        strokeWidth={0}
                        dot={{ r: 6, fill: '#10b981', stroke: '#064e3b', strokeWidth: 2 }} 
                        isAnimationActive={false}
                      />

                      {/* Sell Signals */}
                      <Line 
                        yAxisId="mco" 
                        type="monotone" 
                        dataKey={(d) => d.mco_signal === 'SELL' ? d.mco : null} 
                        name="▼ SELL Signal" 
                        stroke="#ef4444" 
                        strokeWidth={0}
                        dot={{ r: 6, fill: '#ef4444', stroke: '#7f1d1d', strokeWidth: 2 }} 
                        isAnimationActive={false}
                      />

                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </MarketHealthGuideCard>

              {/* Chart 3: Market Breadth (% > 50 SMA) */}
              <MarketHealthGuideCard
                icon={BarChart2}
                title="Market Breadth (% Above 50 SMA)"
                subtitle="Intermediate Trend Participation Across Lakehouse Equities"
                badges={[
                  { label: '% > 50 SMA', value: `${marketHealth.current_health.pct_above_50_value}%`, color: marketHealth.current_health.pct_above_50_value > 50 ? '#10b981' : '#ef4444' },
                  { label: '% > 200 SMA', value: `${marketHealth.current_health.pct_above_200_value}%`, color: marketHealth.current_health.pct_above_200_value > 50 ? '#10b981' : '#ef4444' },
                  { label: 'MACD Hist', value: `${marketHealth.current_health.macd_p50_val !== undefined ? marketHealth.current_health.macd_p50_val : ''}`, color: (marketHealth.current_health.macd_p50_val || 0) > 0 ? '#10b981' : '#ef4444' }
                ]}
                biasLabel={marketHealth.current_health.breadth_status}
                biasColor={marketHealth.current_health.pct_above_50_value > 60 ? '#10b981' : marketHealth.current_health.pct_above_50_value < 50 ? '#ef4444' : '#f59e0b'}
                cardBorderColor="rgba(59, 130, 246, 0.2)"
                algoInsight={marketHealth.current_health.chart_observations?.p50 || `${marketHealth.current_health.pct_above_50_value}% of stocks above 50 SMA.`}
                whatItMeasures="Percentage of all tracked equities trading above their 50-day moving average, paired with Breadth MACD. Strips out cap-weighting distortions to reveal whether the average stock is participating or rotting under the surface."
                benchmarks={[
                  { level: '> 75%', meaning: 'Strong Bull Market: Broad institutional sponsorship across sectors.', color: '#10b981' },
                  { level: '50% Waterline', meaning: 'Bull/Bear Pivot: Above 50% favors longs; below 50% warns of decay.', color: '#64748b' },
                  { level: '< 25%', meaning: 'Severe Washout: 3 out of 4 stocks broken; multi-week reversal bottoms form.', color: '#ef4444' }
                ]}
                playbook={[
                  'Above 50% + MACD > 0: Aggressive offense. Breakouts (VCP, Cup & Handle, Bull Flags) have high follow-through (>65%).',
                  'Below 50% + MACD < 0: Defense. Over 50% of stocks in intermediate downtrends. Breakouts will fail into overhead supply.',
                  'Divergence: If SPY makes higher highs while % > 50 SMA makes lower highs, a major correction is brewing.'
                ]}
              >
                <div style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} domain={[0, 100]} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: '8px' }} />
                      <ReferenceLine y={50} stroke="#475569" strokeDasharray="3 3" label={{ position: 'right', value: '50% Waterline', fill: '#94a3b8', fontSize: 10 }} />
                      <ReferenceLine y={75} stroke="#10b981" strokeDasharray="2 2" strokeOpacity={0.6} label={{ position: 'right', value: 'Bull Thrust (75%)', fill: '#10b981', fontSize: 9 }} />
                      <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="2 2" strokeOpacity={0.6} label={{ position: 'right', value: 'Oversold (25%)', fill: '#ef4444', fontSize: 9 }} />
                      <Area type="monotone" dataKey="pct_above_50" name="% > 50 SMA" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBreadth)" style={{ filter: 'drop-shadow(0px 0px 4px rgba(59, 130, 246, 0.4))' }} />
                      <Line type="monotone" dataKey="pct_above_200" name="% > 200 SMA" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </MarketHealthGuideCard>
            </div>

            {/* Grid for Secondary Indicators (NH-NL & Volatility Skew) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '2rem' }}>
              
              {/* Chart 4: New Highs vs New Lows */}
              <MarketHealthGuideCard
                icon={BarChart2}
                title="New Highs vs New Lows (NH-NL Expansion)"
                subtitle="20-Day Extreme Differentials & Stealth Distribution Warnings"
                badges={[
                  { label: 'New Highs', value: marketHealth.current_health.new_highs_count || 0, color: '#10b981' },
                  { label: 'New Lows', value: marketHealth.current_health.new_lows_count || 0, color: '#ef4444' },
                  { label: '10D MA', value: marketHealth.current_health.nhnl_10d_ma !== undefined ? marketHealth.current_health.nhnl_10d_ma : (marketHealth.current_health.chart_observations?.nhnl || '0'), color: (marketHealth.current_health.nhnl_10d_ma || 0) > 0 ? '#10b981' : '#ef4444' }
                ]}
                biasLabel={(marketHealth.current_health.nhnl_10d_ma || 0) > 0 ? 'Accumulation' : 'Distribution'}
                biasColor={(marketHealth.current_health.nhnl_10d_ma || 0) > 0 ? '#10b981' : '#ef4444'}
                algoInsight={marketHealth.current_health.chart_observations?.nhnl || `10-Day NH-NL Differential MA is ${marketHealth.current_health.nhnl_10d_ma || 0}.`}
                whatItMeasures="Daily count of stocks printing new 20-day highs vs new lows, smoothed by a 10-day MA. In healthy bull markets, New Highs vastly dominate. Expanding New Lows near market highs reveal 'stealth institutional distribution'."
                benchmarks={[
                  { level: '10D MA > +500', meaning: 'Net Institutional Accumulation: Leading equities breaking out.', color: '#10b981' },
                  { level: '10D MA -200 to +200', meaning: 'Rotational Equilibrium: Healthy sector-by-sector rotation.', color: '#f59e0b' },
                  { level: '10D MA < -500', meaning: 'Net Institutional Distribution: Systemic breakdowns dominating.', color: '#ef4444' },
                  { level: 'Hindenburg / Titanic', meaning: 'Crash Warning: Index near highs while New Lows expand (>2.8%).', color: '#ec4899' }
                ]}
                playbook={[
                  'When New Lows > 1,500 daily: Avoid buying early dip attempts; cascading stop-outs likely across secondary stocks.',
                  'When New Lows contract < 300 and New Highs expand > 1,200: Institutional all-clear signal; buy new swing breakouts.',
                  'Titanic Warning: If SPY is within 7 days of 52-week highs while New Lows > New Highs, cut weak positions immediately.'
                ]}
              >
                <div style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
                      <Bar dataKey="new_highs" name="New Highs" fill="#10b981" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="new_lows" name="New Lows" fill="#ef4444" radius={[2, 2, 0, 0]} />
                      <Line type="monotone" dataKey="nhnl_10" name="10D Net Diff MA" stroke="#38bdf8" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </MarketHealthGuideCard>

              {/* Chart 5: Volatility Skew */}
              <MarketHealthGuideCard
                icon={ShieldAlert}
                title="CBOE Volatility Skew (VIX vs VIX3M Term Structure)"
                subtitle="Spot Fear vs 3-Month Hedging Premium & Bollinger Band Extreme Exits"
                badges={[
                  { label: 'Spot VIX', value: marketHealth.current_health.vix_value || 15.8, color: '#ef4444' },
                  { label: 'VIX3M', value: marketHealth.current_health.vix3m_value || 18.6, color: '#3b82f6' },
                  { label: 'Ratio', value: marketHealth.current_health.vix_ratio || 0.85, color: (marketHealth.current_health.vix_ratio || 0.85) < 1.0 ? '#10b981' : '#ef4444' }
                ]}
                biasLabel={marketHealth.current_health.vix_structure || 'Contango (Normal)'}
                biasColor={marketHealth.current_health.vix_structure?.includes('Contango') ? '#10b981' : '#ef4444'}
                cardBorderColor="rgba(239, 68, 68, 0.2)"
                algoInsight={marketHealth.current_health.chart_observations?.vix_curve || marketHealth.current_health.chart_observations?.vix_bands || `VIX at ${marketHealth.current_health.vix_value || 15.8} vs VIX3M ${marketHealth.current_health.vix3m_value || 18.6}.`}
                whatItMeasures="Ratio of spot 30-day implied volatility (VIX) to 3-month implied volatility (VIX3M). Contango (VIX < VIX3M, Ratio < 1.0) reflects normal calm conditions. Backwardation (VIX > VIX3M, Ratio > 1.0) reflects acute near-term institutional panic hedging."
                benchmarks={[
                  { level: 'Contango (< 0.90)', meaning: 'Normal Regime: Low-stress volatility curve favorable for equity swings.', color: '#10b981' },
                  { level: 'Flat (0.90 - 1.00)', meaning: 'Caution: Hedging demand rising ahead of imminent catalysts.', color: '#f59e0b' },
                  { level: 'Backwardation (> 1.00)', meaning: 'Inverted Panic Curve: Acute crisis hedging; market in high-volatility regime.', color: '#ef4444' },
                  { level: 'VIX Upper BB Pierce', meaning: 'Extreme Fear Climax: VIX extended 2+ standard deviations above 20 SMA.', color: '#ec4899' }
                ]}
                playbook={[
                  'In Backwardation (Ratio > 1.0): Do not hold overnight unhedged long momentum positions. Expect violent 1-2% intraday whipsaws.',
                  'VIX Upper BB Re-entry: When VIX spikes outside its upper Bollinger Band and closes back inside, initiate long index swings with stop below recent pivot.',
                  'In Contango: Trend continuation favored; hold winning long setups with trailing stops along 21-EMA.'
                ]}
              >
                <div style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <ReferenceLine y={20} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Elevated Fear (20)', fill: '#f59e0b', fontSize: 10 }} />
                      <Line type="monotone" dataKey="vix" name="VIX (Spot Fear)" stroke="#ef4444" strokeWidth={3} dot={false} style={{ filter: 'drop-shadow(0px 0px 4px rgba(239, 68, 68, 0.5))' }} />
                      <Line type="monotone" dataKey="vix3m" name="VIX3M (3-Month)" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </MarketHealthGuideCard>

            </div>

            {/* Grid for Bottom Indicators (Credit Spreads & Divergences) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '2rem' }}>
              
              {/* Chart 6: Credit Spreads */}
              <MarketHealthGuideCard
                icon={ActivitySquare}
                title="Institutional Credit Spreads (HYG / IEF Risk-Appetite)"
                subtitle="High Yield vs Treasury Ratio with 126-Day Rolling Z-Score"
                badges={[
                  { label: 'HYG/IEF', value: marketHealth.current_health.hyg_ratio_val || 0.86, color: '#f59e0b' },
                  { label: 'Z-Score', value: `${(marketHealth.current_health.hyg_zscore_val || 0) > 0 ? '+' : ''}${marketHealth.current_health.hyg_zscore_val || 0}`, color: (marketHealth.current_health.hyg_zscore_val || 0) > 0 ? '#10b981' : '#ef4444' }
                ]}
                biasLabel={(marketHealth.current_health.hyg_zscore_val || 0) > 0 ? 'Risk Appetite (Z>0)' : 'Credit Risk-Off (Z<0)'}
                biasColor={(marketHealth.current_health.hyg_zscore_val || 0) > 0 ? '#10b981' : '#ef4444'}
                algoInsight={marketHealth.current_health.chart_observations?.credit || `HYG/IEF credit spread Z-Score is ${marketHealth.current_health.hyg_zscore_val || 0}.`}
                whatItMeasures="Price ratio of High-Yield Junk Bonds (HYG) to 7-10 Year Treasuries (IEF), normalized via a 126-day rolling Z-Score. Bond institutions rigorously analyze default risk and corporate solvency. When credit spreads widen, liquidity dries up before it is visible in SPY."
                benchmarks={[
                  { level: 'Z-Score > +1.0', meaning: 'Strong Credit Appetite: Institutions actively funding corporate debt; confirms rallies.', color: '#10b981' },
                  { level: 'Z-Score 0 to +1.0', meaning: 'Neutral / Stable: Normal credit risk conditions.', color: '#f59e0b' },
                  { level: 'Z-Score < -1.5', meaning: 'Liquidity Warning: Credit spreads widening; capital cost surging.', color: '#ef4444' },
                  { level: 'Z-Score < -2.0', meaning: 'Distress / Liquidity Contraction: High risk of forced equity liquidations.', color: '#ec4899' }
                ]}
                playbook={[
                  'Bullish Confirmation: If SPY is breaking out and HYG/IEF Z-Score is > 0, institutions are financing risk. Size positions normally.',
                  'Credit Divergence: If SPY rallies while HYG/IEF plunges (Z < -1.0), do NOT buy breakouts. Equity rallies without credit backing are traps.',
                  'Credit Bottom: When HYG/IEF stabilizes after a deep drawdown and crosses above its 20-day EMA, buy high-beta equities.'
                ]}
              >
                <div style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="ratio" stroke="#f59e0b" tick={{fill: '#f59e0b', fontSize: 11}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="zscore" orientation="right" stroke="#38bdf8" tick={{fill: '#38bdf8', fontSize: 11}} domain={[-4, 4]} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine yAxisId="zscore" y={0} stroke="#64748b" strokeWidth={1} />
                      <ReferenceLine yAxisId="zscore" y={-1.5} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideBottomRight', value: 'Stress Alert (-1.5σ)', fill: '#ef4444', fontSize: 9 }} />
                      <Line yAxisId="ratio" type="monotone" dataKey="hyg_ratio" name="HYG/IEF Ratio" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                      <Line yAxisId="zscore" type="monotone" dataKey="hyg_zscore" name="126D Z-Score" stroke="#38bdf8" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </MarketHealthGuideCard>

              {/* Chart 7: Index Divergences */}
              <MarketHealthGuideCard
                icon={Compass}
                title="Sector & Size Divergences (Mega-Cap vs Equal-Weight)"
                subtitle="Cap-Weighted vs Equal-Weighted Breadth & Tech Leadership"
                badges={[
                  { label: 'SPY/RSP', value: marketHealth.current_health.spy_rsp_ratio_val || 3.56, color: '#94a3b8' },
                  { label: 'QQQ/SPY', value: marketHealth.current_health.qqq_spy_ratio_val || 0.94, color: '#8b5cf6' },
                  { label: 'XLK/XLU', value: marketHealth.current_health.xlk_xlu_ratio_val || 4.36, color: '#38bdf8' }
                ]}
                biasLabel="Mega-Cap Dominance"
                biasColor="#8b5cf6"
                algoInsight={marketHealth.current_health.chart_observations?.divergence || `Cap-weighted SPY/RSP ratio is ${marketHealth.current_health.spy_rsp_ratio_val || 3.56}. Tech/Defensive (XLK/XLU) ratio is ${marketHealth.current_health.xlk_xlu_ratio_val || 4.36}.`}
                whatItMeasures="Compares Cap-Weighted S&P 500 (SPY) vs Equal-Weighted S&P 500 (RSP) to detect mega-cap concentration, paired with QQQ/SPY (tech momentum) and XLK/XLU (growth vs defensive utility bond-proxies)."
                benchmarks={[
                  { level: 'SPY/RSP Rising', meaning: 'Mega-Cap Concentration: Few giants carrying index; median stock lagging.', color: '#8b5cf6' },
                  { level: 'SPY/RSP Falling', meaning: 'Democratic Breadth: Broad participation across small/mid/large caps (healthiest).', color: '#10b981' },
                  { level: 'QQQ/SPY Rising', meaning: 'Tech Leadership: High-beta growth driving overall market returns.', color: '#38bdf8' },
                  { level: 'XLK/XLU Rising', meaning: 'Offensive Growth: Capital rotating into risk assets from safe-havens.', color: '#10b981' }
                ]}
                playbook={[
                  'When SPY/RSP is rising steeply: Limit new longs strictly to mega-cap market leaders (e.g. Mag 7); avoid secondary mid-caps.',
                  'When SPY/RSP is declining: Broaden scan criteria to small-cap and mid-cap growth stocks (IWM/MDY setups).',
                  'When XLK/XLU breaks below its 50-day MA: Defensive rotation underway; raise cash and reduce high-PE growth exposure.'
                ]}
              >
                <div style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" tick={{fill: '#8b5cf6', fontSize: 12}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <Line yAxisId="left" type="monotone" dataKey="spy_rsp_ratio" name="SPY/RSP (Mega-Cap)" stroke="#94a3b8" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="qqq_spy_ratio" name="QQQ/SPY (Tech)" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </MarketHealthGuideCard>
            </div>

            {/* Grid for Macro Institutional Data (COT & T-Bill) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '2rem' }}>
              
              {/* Chart 8: Money Market Liquidity (13-Week T-Bill) */}
              <MarketHealthGuideCard
                icon={Activity}
                title="Money Market Liquidity (13-Week T-Bill Yield - ^IRX)"
                subtitle="Benchmark Risk-Free Cash Return & Equity Multiple Hurdle Rate"
                badges={[
                  { label: '13W Yield', value: `${marketHealth.current_health.irx_val || 3.91}%`, color: '#38bdf8' }
                ]}
                biasLabel={(marketHealth.current_health.irx_val || 0) > 4.0 ? 'Elevated Hurdle' : 'Accommodative'}
                biasColor={(marketHealth.current_health.irx_val || 0) > 4.0 ? '#f59e0b' : '#38bdf8'}
                algoInsight={marketHealth.current_health.chart_observations?.irx_liquidity || `13-Week T-Bill Yield is ${marketHealth.current_health.irx_val || 3.91}%.`}
                whatItMeasures="Annualized yield on 3-month US Treasury Bills (^IRX). Represents the baseline hurdle rate for institutional capital. When risk-free cash yields 4-5%, equity valuation multiples face valuation headwinds. When yields drop, liquidity floods into equities."
                benchmarks={[
                  { level: '> 4.5%', meaning: 'High Hurdle Rate: Cash competes with equities; PE multiples face compression.', color: '#f59e0b' },
                  { level: '3.0% - 4.5%', meaning: 'Moderate Cost of Capital: Balanced monetary environment.', color: '#64748b' },
                  { level: '< 3.0%', meaning: 'Accommodative: Low hurdle rate fuels multiple expansion and speculative risk.', color: '#10b981' },
                  { level: 'Falling Trend', meaning: 'Monetary Easing: Capital departs money market funds seeking equity returns.', color: '#38bdf8' }
                ]}
                playbook={[
                  'During Falling Yields: Favor high-duration growth assets, unprofitable high-revenue tech, and small-caps.',
                  'During Elevated Yields (> 4%): Demand high free cash flow yields and robust balance sheets; speculative growth underperforms.',
                  'Yield Spikes: Sudden yield surges trigger multi-day equity contractions as discount rates adjust.'
                ]}
              >
                <div style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <ReferenceLine y={4.0} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'High Hurdle (4.0%)', fill: '#f59e0b', fontSize: 10 }} />
                      <Line type="monotone" dataKey="irx" name="13-Week Yield (%)" stroke="#38bdf8" strokeWidth={3} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </MarketHealthGuideCard>

              {/* Chart 9: CFTC COT S&P 500 Positioning */}
              <MarketHealthGuideCard
                icon={FileText}
                title="CFTC Commitments of Traders (COT S&P 500 Net Commercials)"
                subtitle="Smart Money Institutional Commercial Positioning on CME E-Mini Futures"
                badges={[
                  { label: 'Net Contracts', value: marketHealth.current_health.cot_net_val ? marketHealth.current_health.cot_net_val.toLocaleString() : (marketHealth.current_health.chart_observations?.cot || '-50,017'), color: (marketHealth.current_health.cot_net_val || 0) > 0 ? '#10b981' : '#f59e0b' }
                ]}
                biasLabel={(marketHealth.current_health.cot_net_val || 0) > 0 ? 'Smart Money Long' : 'Hedging Inventory'}
                biasColor={(marketHealth.current_health.cot_net_val || 0) > 0 ? '#10b981' : '#f59e0b'}
                algoInsight={marketHealth.current_health.chart_observations?.cot || `Net Commercial Positioning on S&P 500 is ${marketHealth.current_health.cot_net_val || -50017}.`}
                whatItMeasures="Weekly net positioning (Longs - Shorts) of Commercial Hedgers on CME E-Mini S&P 500 futures published by the CFTC. Commercials represent institutional producers, banks, and underwriters who hedge physical equities; speculators are trend-followers."
                benchmarks={[
                  { level: 'Net Short (-50k to -120k)', meaning: 'Normal Bull Hedging: Commercials hedge large physical long portfolios.', color: '#f59e0b' },
                  { level: 'Extreme Short (< -150k)', meaning: 'Over-Hedged / Euphoria: Retail heavily long; market vulnerable to corrections.', color: '#ef4444' },
                  { level: 'Net Positive / Zero Cross', meaning: 'Smart Money Accumulation: Commercials covering shorts or turning net long.', color: '#10b981' },
                  { level: 'Positive Extremes', meaning: 'Generational Buying Climax: Historically coincides with secular market bottoms.', color: '#ec4899' }
                ]}
                playbook={[
                  'Do not short a bull market simply because commercials are net short; this is their normal operational hedging baseline.',
                  'Watch for turning points: When commercials rapidly cover 50,000+ contracts during a decline, institutional bottom-fishing has begun.',
                  'When commercials flip net long: Aggressively deploy capital into multi-month swing and LEAPS call positions.'
                ]}
              >
                <div style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <ReferenceLine y={0} stroke="#475569" strokeWidth={2} />
                      <Bar dataKey="cot_net" name="Net Positioning" radius={[2, 2, 0, 0]}>
                        {marketHealth.historical_data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.cot_net > 0 ? '#10b981' : '#ef4444'} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </MarketHealthGuideCard>

            </div>

          </div>
        </div>
      )}

      {/* RRG Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <>
          <div className="timeframe-toggles">
            <button className={timeframe === 'intraday' ? 'active' : ''} onClick={() => { setTimeframe('intraday'); setHiddenLines({}); setIsTop5Isolated(false); }}>Intraday (15m)</button>
            <button className={timeframe === 'daily' ? 'active' : ''} onClick={() => { setTimeframe('daily'); setHiddenLines({}); setIsTop5Isolated(false); }}>Daily (Short-Term)</button>
            <button className={timeframe === 'weekly' ? 'active' : ''} onClick={() => { setTimeframe('weekly'); setHiddenLines({}); setIsTop5Isolated(false); }}>Weekly (Medium-Term)</button>
            <button className={timeframe === 'monthly' ? 'active' : ''} onClick={() => { setTimeframe('monthly'); setHiddenLines({}); setIsTop5Isolated(false); }}>Monthly (Structural)</button>
          </div>

          <div className="dashboard-grid">
            <div className="glass-card chart-card" style={{ paddingBottom: '3rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ textAlign: 'left', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp color="#4facfe" /> Relative Rotation Graph ({timeframe})
                </h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setIsTop5Isolated(false); setHiddenLines({}) }} className={`isolate-btn ${!isTop5Isolated && !hiddenLines['grid'] ? 'isolated' : ''}`}><Activity size={16} />All</button>
                  <button onClick={isolateTop5} className={`isolate-btn ${isTop5Isolated ? 'isolated' : ''}`}><Filter size={16} />Top 5</button>
                  <button onClick={() => setHiddenLines({ 'grid': true })} className={`isolate-btn ${hiddenLines['grid'] ? 'isolated' : ''}`}><ActivitySquare size={16} />Grid View (Separate)</button>
                </div>
              </div>
              
              {!hiddenLines['grid'] ? (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '70px', right: '30px', color: '#10b981', fontWeight: 'bold', fontSize: '1.2rem', opacity: 0.5 }}>LEADING</div>
                  <div style={{ position: 'absolute', bottom: '150px', right: '30px', color: '#f59e0b', fontWeight: 'bold', fontSize: '1.2rem', opacity: 0.5 }}>WEAKENING</div>
                  <div style={{ position: 'absolute', bottom: '150px', left: '80px', color: '#ef4444', fontWeight: 'bold', fontSize: '1.2rem', opacity: 0.5 }}>LAGGING</div>
                  <div style={{ position: 'absolute', top: '70px', left: '80px', color: '#3b82f6', fontWeight: 'bold', fontSize: '1.2rem', opacity: 0.5 }}>IMPROVING</div>

                  <div style={{ height: '650px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <ReferenceArea x1={100} y1={100} fill="rgba(16, 185, 129, 0.05)" /> 
                        <ReferenceArea x1={100} y2={100} fill="rgba(245, 158, 11, 0.05)" /> 
                        <ReferenceArea x2={100} y2={100} fill="rgba(239, 68, 68, 0.05)" /> 
                        <ReferenceArea x2={100} y1={100} fill="rgba(59, 130, 246, 0.05)" /> 
                        <ReferenceLine x={100} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                        <ReferenceLine y={100} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                        <XAxis type="number" dataKey="x" name="RS-Ratio" domain={['dataMin - 3', 'dataMax + 4']} stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.5)' }} />
                        <YAxis type="number" dataKey="y" name="RS-Momentum" domain={['dataMin - 3', 'dataMax + 4']} stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.5)' }} />
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                        <Legend content={renderCustomLegend} verticalAlign="bottom" />
                        
                        {rrgData.map((sector, idx) => {
                          if (hiddenLines[sector.name]) return null;
                          const isHovered = hoveredSector === sector.name;
                          const isAnotherHovered = hoveredSector !== null && hoveredSector !== sector.name;
                          const color = COLORS[idx % COLORS.length];
                          
                          return (
                            <Scatter 
                              key={sector.name} name={sector.name} 
                              data={sector.trail.map((pt, i) => ({ ...pt, labelName: i === sector.trail.length - 1 ? sector.name : '' }))} 
                              fill={color}
                              line={{ type: "monotone", stroke: color, strokeWidth: isHovered ? 4 : 2 }}
                              opacity={isAnotherHovered ? 0.1 : 1} style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                              onClick={() => setModalData(sector)}
                            >
                              <LabelList dataKey="labelName" position="right" offset={8} style={{ fill: 'white', fontSize: '13px', fontWeight: 'bold', textShadow: `0px 0px 4px ${color}, 0px 0px 8px black` }} />
                              {sector.trail.map((entry, index) => {
                                const isLast = index === sector.trail.length - 1;
                                return <Cell key={`cell-${index}`} fill={color} r={isLast ? (isHovered ? 12 : 8) : 0} opacity={isLast ? 1 : 0} />
                              })}
                            </Scatter>
                          )
                        })}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginTop: '20px' }}>
                  {rrgData.map((sector, idx) => {
                    const color = COLORS[idx % COLORS.length];
                    return (
                      <div key={sector.name} className="stat-card" style={{ padding: '10px', height: '250px', cursor: 'pointer' }} onClick={() => setModalData(sector)}>
                        <h4 style={{ margin: '0 0 10px 0', textAlign: 'center', color: color }}>{sector.name}</h4>
                        <ResponsiveContainer width="100%" height="85%">
                          <ScatterChart margin={{ top: 5, right: 15, bottom: 5, left: 5 }}>
                            <ReferenceArea x1={100} y1={100} fill="rgba(16, 185, 129, 0.05)" /> 
                            <ReferenceArea x1={100} y2={100} fill="rgba(245, 158, 11, 0.05)" /> 
                            <ReferenceArea x2={100} y2={100} fill="rgba(239, 68, 68, 0.05)" /> 
                            <ReferenceArea x2={100} y1={100} fill="rgba(59, 130, 246, 0.05)" /> 
                            <ReferenceLine x={100} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                            <ReferenceLine y={100} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                            <XAxis type="number" dataKey="x" domain={['dataMin - 1', 'dataMax + 1']} hide />
                            <YAxis type="number" dataKey="y" domain={['dataMin - 1', 'dataMax + 1']} hide />
                            <Tooltip content={<CustomTooltip />} cursor={false} />
                            <Scatter 
                              name={sector.name} 
                              data={sector.trail} 
                              fill={color}
                              line={{ type: "monotone", stroke: color, strokeWidth: 2 }}
                            >
                              {sector.trail.map((entry, index) => {
                                const isLast = index === sector.trail.length - 1;
                                return <Cell key={`mini-cell-${index}`} fill={color} r={isLast ? 6 : 0} opacity={isLast ? 1 : 0} />
                              })}
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="glass-card alerts-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ textAlign: 'left', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle color="#10b981" /> Structural Leaders
              </h2>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {tableData.slice(0, 5).map((sec, idx) => {
                  const current = sec.trail[sec.trail.length - 1];
                  const isLeading = current.x > 100 && current.y > 100;
                  return (
                    <div key={idx} className="alert-item" style={{ borderLeft: `4px solid ${isLeading ? '#10b981' : '#f59e0b'}`, paddingLeft: '1rem', marginBottom: '1rem', cursor: 'pointer' }} onClick={() => setModalData(sec)}>
                      <div className="alert-content">
                        <h4>{sec.name}</h4>
                        <p style={{ margin: '5px 0' }}>Trend: <strong>{current.x}</strong> | Mom: <strong>{current.y}</strong></p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Multi-Timeframe Trade Playbook */}
          <div className="glass-card" style={{ marginTop: '20px' }}>
            <h2 style={{ textAlign: 'left', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Compass color="#a855f7" /> Multi-Timeframe Trade Playbook
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '20px' }}>
              The engine automatically maps sector quadrant positions across Monthly, Weekly, and Daily timeframes to find actionable trade setups based on cross-timeframe alignment.
            </p>
            
            {(() => {
              const playbooks = getMultiTimeframeSummary();
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  
                  {/* Pullback Buys */}
                  <div className="stat-card" style={{ padding: '15px' }}>
                    <h3 style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                      <ActivitySquare size={18} /> Pullback Buys
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 10px 0' }}>Structural uptrend, short-term dip.</p>
                    {playbooks.pullbackBuys.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No setups.</p> : playbooks.pullbackBuys.map((s, i) => (
                      <div key={i} style={{ marginBottom: '12px', fontSize: '0.9rem', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <strong>{s.name}</strong> 
                        <span style={{ color: '#888', display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>{s.status}</span>
                        {s.topStocks && <span style={{ color: '#4facfe', display: 'block', fontSize: '0.8rem', marginTop: '4px', fontWeight: 500 }}>{s.topStocks}</span>}
                      </div>
                    ))}
                  </div>

                  {/* Emerging Leaders */}
                  <div className="stat-card" style={{ padding: '15px' }}>
                    <h3 style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                      <TrendingUp size={18} /> Emerging Leaders
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 10px 0' }}>Early-stage momentum shift.</p>
                    {playbooks.emergingLeaders.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No setups.</p> : playbooks.emergingLeaders.map((s, i) => (
                      <div key={i} style={{ marginBottom: '12px', fontSize: '0.9rem', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <strong>{s.name}</strong> 
                        <span style={{ color: '#888', display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>{s.status}</span>
                        {s.topStocks && <span style={{ color: '#4facfe', display: 'block', fontSize: '0.8rem', marginTop: '4px', fontWeight: 500 }}>{s.topStocks}</span>}
                      </div>
                    ))}
                  </div>

                  {/* Exhaustion Warnings */}
                  <div className="stat-card" style={{ padding: '15px' }}>
                    <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                      <AlertCircle size={18} /> Exhaustion Warnings
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 10px 0' }}>Macro leader breaking down short-term.</p>
                    {playbooks.exhaustionWarnings.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No setups.</p> : playbooks.exhaustionWarnings.map((s, i) => (
                      <div key={i} style={{ marginBottom: '12px', fontSize: '0.9rem', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <strong>{s.name}</strong> 
                        <span style={{ color: '#888', display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>{s.status}</span>
                        {s.topStocks && <span style={{ color: '#4facfe', display: 'block', fontSize: '0.8rem', marginTop: '4px', fontWeight: 500 }}>{s.topStocks}</span>}
                      </div>
                    ))}
                  </div>

                  {/* Full Throttle */}
                  <div className="stat-card" style={{ padding: '15px' }}>
                    <h3 style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                      <Zap size={18} /> Full Throttle
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 10px 0' }}>Leading on all timeframes.</p>
                    {playbooks.fullThrottle.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No setups.</p> : playbooks.fullThrottle.map((s, i) => (
                      <div key={i} style={{ marginBottom: '12px', fontSize: '0.9rem', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <strong>{s.name}</strong> 
                        <span style={{ color: '#888', display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>{s.status}</span>
                        {s.topStocks && <span style={{ color: '#4facfe', display: 'block', fontSize: '0.8rem', marginTop: '4px', fontWeight: 500 }}>{s.topStocks}</span>}
                      </div>
                    ))}
                  </div>

                </div>
              )
            })()}
          </div>

          {/* Automated Money Flow Summary */}
          <div className="glass-card" style={{ marginTop: '20px' }}>
            <h2 style={{ textAlign: 'left', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
              <Zap color="#f59e0b" /> Automated Money Flow Summary ({timeframe})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <h3 style={{ color: '#10b981', marginTop: 0 }}>🟢 Fresh Money Inflow</h3>
                <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '10px' }}>Institutional capital is actively rotating INTO these sectors (Momentum is rising).</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {moneyFlow.freshMoney.map(sec => (
                    <span key={sec.name} style={{ background: '#10b981', color: '#000', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      #{sec.rank} {sec.name} {sec.improving ? '📈' : '📉'}
                    </span>
                  ))}
                  {moneyFlow.freshMoney.length === 0 && <span style={{ color: '#888', fontSize: '0.9rem' }}>No sectors detected.</span>}
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <h3 style={{ color: '#f59e0b', marginTop: 0 }}>🟡 Profit Taking</h3>
                <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '10px' }}>Money is moving OUT of these previous leaders (Momentum is falling).</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {moneyFlow.profitTaking.map(sec => (
                    <span key={sec.name} style={{ background: '#f59e0b', color: '#000', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      #{sec.rank} {sec.name} {sec.improving ? '📈' : '📉'}
                    </span>
                  ))}
                  {moneyFlow.profitTaking.length === 0 && <span style={{ color: '#888', fontSize: '0.9rem' }}>No sectors detected.</span>}
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <h3 style={{ color: '#ef4444', marginTop: 0 }}>🔴 Dead Money</h3>
                <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '10px' }}>Sectors trapped in structural downtrends (Lagging quadrant).</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {moneyFlow.deadMoney.map(sec => (
                    <span key={sec.name} style={{ background: '#ef4444', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      #{sec.rank} {sec.name} {sec.improving ? '📈' : '📉'}
                    </span>
                  ))}
                  {moneyFlow.deadMoney.length === 0 && <span style={{ color: '#888', fontSize: '0.9rem' }}>No sectors detected.</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Timeframe Focus List */}
          <div className="glass-card" style={{ marginTop: '20px' }}>
            <h2 style={{ textAlign: 'left', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
              🔥 Multi-Timeframe Focus List
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>
              Top stocks from sectors exhibiting structural alignment (Leading on Monthly/Weekly, hooking up on Daily).
            </p>
            {multiTimeframeFocusList.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                {multiTimeframeFocusList.map((stock, idx) => (
                  <div key={`${stock.ticker}-${idx}`} onClick={() => fetchTickerData(stock.ticker)} style={{ cursor: 'pointer', background: 'rgba(15, 23, 42, 0.6)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.2s, border 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.border = '1px solid #4facfe' }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <strong style={{ fontSize: '1.2rem', color: '#4facfe' }}>{stock.ticker}</strong>
                      <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', color: '#fff' }}>{stock.sectorName}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ color: stock.stage?.includes('2') ? '#10b981' : '#f59e0b' }}>{stock.stage}</span>
                      <span style={{ color: stock.momentum_color === 'bullish' ? '#10b981' : stock.momentum_color === 'bearish' ? '#ef4444' : '#f59e0b', fontWeight: 'bold' }}>{stock.momentum_text.split(' ')[0]} {stock.rs_spy_1mo > 0 ? `+${stock.rs_spy_1mo.toFixed(1)}%` : `${stock.rs_spy_1mo.toFixed(1)}%`} RS</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <p style={{ color: '#94a3b8' }}>No stocks currently meet the strict multi-timeframe alignment criteria.</p>
              </div>
            )}
          </div>

          {/* Emerging Leaders Focus List */}
          <div className="glass-card" style={{ marginTop: '20px' }}>
            <h2 style={{ textAlign: 'left', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
              🌱 Emerging Leaders (Early Rotation)
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>
              Top stocks from sectors transitioning into the Improving quadrant with immediate short-term momentum.
            </p>
            {emergingLeadersList.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                {emergingLeadersList.map((stock, idx) => (
                  <div key={`${stock.ticker}-${idx}-emerging`} onClick={() => fetchTickerData(stock.ticker)} style={{ cursor: 'pointer', background: 'rgba(16, 185, 129, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', transition: 'transform 0.2s, border 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.border = '1px solid #10b981' }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.border = '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>{stock.ticker}</strong>
                      <span style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: '12px', color: '#fff' }}>{stock.sectorName}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ color: stock.stage?.includes('2') ? '#10b981' : '#f59e0b' }}>{stock.stage}</span>
                      <span style={{ color: stock.momentum_color === 'bullish' ? '#10b981' : stock.momentum_color === 'bearish' ? '#ef4444' : '#f59e0b', fontWeight: 'bold' }}>{stock.momentum_text.split(' ')[0]} {stock.rs_spy_1mo > 0 ? `+${stock.rs_spy_1mo.toFixed(1)}%` : `${stock.rs_spy_1mo.toFixed(1)}%`} RS</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                <p style={{ color: '#10b981' }}>No early-rotation sectors currently detected.</p>
              </div>
            )}
          </div>

          {/* Detailed Sector Rankings */}
          <div className="glass-card" style={{ marginTop: '20px' }}>
            <h2 style={{ textAlign: 'left', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
              <List color="#4facfe" /> Sector Rankings & Momentum ({timeframe})
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '12px 10px', color: '#94a3b8' }}>Rank</th>
                    <th style={{ padding: '12px 10px', color: '#94a3b8' }}>Sector</th>
                    <th style={{ padding: '12px 10px', color: '#94a3b8' }}>Trend (RS-Ratio)</th>
                    <th style={{ padding: '12px 10px', color: '#94a3b8' }}>Momentum</th>
                    <th style={{ padding: '12px 10px', color: '#94a3b8' }}>Trajectory</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((sec, idx) => {
                    const current = sec.trail[sec.trail.length - 1];
                    const prev = sec.trail.length > 3 ? sec.trail[sec.trail.length - 3] : sec.trail[0];
                    const momRising = current.y > prev.y;
                    
                    return (
                      <tr key={sec.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '12px 10px', color: '#fff', fontWeight: 'bold' }}>#{idx + 1}</td>
                        <td style={{ padding: '12px 10px', color: '#4facfe', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setModalData(sec)}>{sec.name}</td>
                        <td style={{ padding: '12px 10px', color: current.x >= 100 ? '#10b981' : '#ef4444' }}>{current.x}</td>
                        <td style={{ padding: '12px 10px', color: current.y >= 100 ? '#10b981' : '#ef4444' }}>{current.y}</td>
                        <td style={{ padding: '12px 10px', display: 'flex', alignItems: 'center', gap: '8px', color: momRising ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                          {momRising ? <TrendingUp size={18} /> : <TrendingDown size={18} />} 
                          {momRising ? 'Improving' : 'Deteriorating'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Sector Components Modal */}
      {modalData && (
        <div className="modal-overlay" onClick={() => setModalData(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalData(null)}><X size={24} /></button>
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4facfe' }}>
              <Activity /> {modalData.name} ({modalData.ticker})
            </h2>
            <div className="top-stocks-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
              {modalData.top_stocks && modalData.top_stocks.length > 0 ? (
                modalData.top_stocks.map(stock => (
                  <div key={stock.ticker} className="stock-pill" style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', cursor: 'pointer' }} onClick={() => openLocalTicker(stock)}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{stock.ticker} <BarChart2 size={16} /></strong>
                    <span style={{ color: stock.perf > 0 ? '#10b981' : '#ef4444' }}>{stock.perf > 0 ? '+' : ''}{stock.perf.toFixed(2)}%</span>
                  </div>
                ))
              ) : <span>No data available.</span>}
            </div>
          </div>
        </div>
      )}

      {/* Charting Engine (Center Pane) */}
      {activeTab === 'chart' && (
        <div style={{ width: '100%', height: 'calc(100vh - 120px)' }}>
            {expertTickerData ? (
               <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#fff' }}>{expertTickerData.ticker}</h1>
                      <h3 style={{ margin: 0, color: '#94a3b8', fontSize: '1rem' }}>{expertTickerData.name}</h3>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', padding: '8px 16px', borderRadius: '4px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Activity size={16} /> Pro Terminal: Drawing & Dark Pools
                      </div>
                    </div>
                 </div>
                 <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                   <div style={{ height: '100%', position: 'relative' }}>
                     <UnifiedPlotlyChart ticker={expertTickerData.ticker} />
                   </div>
                   <div style={{ overflowY: 'auto', paddingRight: '10px' }}>
                     {expertTickerData.score !== null && (
                       <div className="glass-card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '1.5rem', background: 'rgba(15, 23, 42, 0.6)' }}>
                         <span style={{ color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Master Algorithm Score</span>
                         <div style={{ fontSize: '4rem', fontWeight: 'bold', color: expertTickerData.score >= 70 ? '#10b981' : expertTickerData.score >= 40 ? '#f59e0b' : '#ef4444', lineHeight: '1', margin: '0.5rem 0' }}>
                           {expertTickerData.score}
                         </div>
                       </div>
                     )}

                     {expertTickerData.agent_insight && (
                       <div className="neo-panel" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #a855f7', background: 'rgba(168, 85, 247, 0.05)' }}>
                         <h3 style={{ margin: '0 0 0.5rem 0', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                           <Activity size={18} /> AI Agent Observation
                         </h3>
                         <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.95rem', lineHeight: '1.5' }}>
                           {expertTickerData.agent_insight}
                         </p>
                       </div>
                     )}

                      {/* ROSS HABER STOCK PERSONALITY PROFILE */}
                      {expertTickerData.personality && (
                        <RossHaberPersonalityPanel personality={expertTickerData.personality} />
                      )}

                     {/* HISTORICAL DNA PROFILE */}
                     <div className="neo-panel" style={{ marginBottom: '1.5rem', background: 'rgba(15, 23, 42, 0.4)' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
                         <h3 style={{ margin: 0, color: '#ec4899', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                           <BarChart2 size={18} /> 10-Year Historical DNA
                         </h3>
                         <button 
                           onClick={() => fetchDNA(expertTickerData.ticker)} 
                           disabled={loadingDna}
                           style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: loadingDna ? 'not-allowed' : 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                         >
                           {loadingDna ? <Loader size={14} className="spin" /> : <Activity size={14} />} 
                           {loadingDna ? 'Analyzing...' : 'Generate Profile'}
                         </button>
                       </div>
                       
                       {dnaData && !dnaData.error && (
                         <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                             <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Moving Average Respect Matrix</span>
                             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                               {Object.entries(dnaData.ma_respect).map(([ma, score]) => (
                                 <div key={ma} style={{ textAlign: 'center' }}>
                                   <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{ma}</div>
                                   <div style={{ fontWeight: 'bold', color: ma === dnaData.best_ma ? '#10b981' : '#e2e8f0' }}>{score}%</div>
                                 </div>
                               ))}
                             </div>
                             <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#10b981' }}>
                               ► Highest respect: {dnaData.best_ma}
                             </div>
                           </div>
                           
                           <div style={{ display: 'flex', gap: '10px' }}>
                             <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                               <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Max Ext. 50-SMA</span>
                               <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>+{dnaData.max_ext_50}%</div>
                             </div>
                             <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                               <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Max Ext. 200-SMA</span>
                               <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>+{dnaData.max_ext_200}%</div>
                             </div>
                           </div>
                           
                           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                             <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Max Streak Potential</span>
                             <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                               <div>Consecutive Up Days: <span style={{ color: '#fff', fontWeight: 'bold' }}>{dnaData.max_green_streak}</span></div>
                               <div>Best Run (&gt;10EMA): <span style={{ color: '#10b981', fontWeight: 'bold' }}>+{dnaData.max_run_above_10ema}%</span></div>
                             </div>
                           </div>
                           
                           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                             <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Whale Activity (Trend Verification)</span>
                             <div style={{ color: '#e2e8f0', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: '1.4' }}>{dnaData.whale_insight}</div>
                           </div>
                           
                           <div style={{ display: 'flex', gap: '10px' }}>
                             <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #a855f7' }}>
                               <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Current Structural Pattern</span>
                               <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#e2e8f0', marginTop: '0.5rem' }}>{dnaData.current_pattern}</div>
                             </div>
                             <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
                               <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Consolidation Timing Estimate</span>
                               <div style={{ fontSize: '0.95rem', color: '#e2e8f0', marginTop: '0.5rem' }}>{dnaData.consolidation_timing}</div>
                             </div>
                           </div>
                           
                           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Technical Adherence Score</span>
                             <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: dnaData.technical_score >= 60 ? '#10b981' : '#ef4444' }}>
                               {dnaData.technical_score}/100
                             </div>
                           </div>
                         </div>
                       )}
                       {dnaData && dnaData.error && (
                         <div style={{ color: '#ef4444', padding: '1rem' }}>{dnaData.error}</div>
                       )}
                     </div>


                     <div className="neo-panel" style={{ marginBottom: '1.5rem' }}>
                       <h3 style={{ margin: '0 0 1rem 0', color: '#4facfe', borderBottom: '1px solid #27272a', paddingBottom: '0.5rem' }}>Technical Health</h3>
                       <div style={{ marginBottom: '1rem' }}>
                         <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Stan Weinstein Phase</p>
                         <strong style={{ fontSize: '1.1rem', color: expertTickerData.technicals.stage.includes('Stage 2') ? '#10b981' : expertTickerData.technicals.stage.includes('Stage 4') ? '#ef4444' : '#f59e0b' }}>
                           {expertTickerData.technicals.stage}
                         </strong>
                       </div>
                       <div style={{ marginBottom: '1rem' }}>
                         <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>MACD / RSI Trajectory</p>
                         <strong style={{ fontSize: '1rem', color: expertTickerData.technicals.momentum_color === 'bullish' ? '#10b981' : expertTickerData.technicals.momentum_color === 'bearish' ? '#ef4444' : '#f59e0b' }}>
                           {expertTickerData.technicals.momentum_text}
                         </strong>
                       </div>
                       <div>
                         <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Relative Strength vs SPY (1 Mo)</p>
                         <strong style={{ fontSize: '1.1rem', color: expertTickerData.technicals.rs_spy_1mo > 0 ? '#10b981' : '#ef4444' }}>
                           {expertTickerData.technicals.rs_spy_1mo > 0 ? '+' : ''}{expertTickerData.technicals.rs_spy_1mo.toFixed(2)}%
                         </strong>
                       </div>
                     </div>

                     {expertTickerData.trade_plan && (
                       <div className="neo-panel" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #10b981' }}>
                         <h3 style={{ margin: '0 0 1rem 0', color: '#10b981', borderBottom: '1px solid #27272a', paddingBottom: '0.5rem' }}>Algorithmic Trade Plan</h3>
                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Ideal Entry</p>
                             <strong style={{ fontSize: '1.1rem', color: '#fff' }}>${expertTickerData.trade_plan.entry.toFixed(2)}</strong>
                           </div>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Target (3 ATR)</p>
                             <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>${expertTickerData.trade_plan.profit_target.toFixed(2)}</strong>
                           </div>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Stop Loss (1.5 ATR)</p>
                             <strong style={{ fontSize: '1.1rem', color: '#ef4444' }}>${expertTickerData.trade_plan.stop_loss.toFixed(2)}</strong>
                           </div>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Risk %</p>
                             <strong style={{ fontSize: '1.1rem', color: '#f59e0b' }}>{expertTickerData.trade_plan.risk_pct.toFixed(1)}%</strong>
                           </div>
                         </div>
                       </div>
                     )}

                     {expertTickerData.fundamentals && (
                       <div className="neo-panel">
                         <h3 style={{ margin: '0 0 1rem 0', color: '#f59e0b', borderBottom: '1px solid #27272a', paddingBottom: '0.5rem' }}>Fundamental Health</h3>
                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Rev Growth</p>
                             <strong style={{ fontSize: '1rem', color: expertTickerData.fundamentals.revenue_growth > 20 ? '#10b981' : '#fff' }}>
                               {expertTickerData.fundamentals.revenue_growth.toFixed(1)}%
                             </strong>
                           </div>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Profit Margin</p>
                             <strong style={{ fontSize: '1rem', color: expertTickerData.fundamentals.profit_margin > 15 ? '#10b981' : '#fff' }}>
                               {expertTickerData.fundamentals.profit_margin.toFixed(1)}%
                             </strong>
                           </div>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>ROE</p>
                             <strong style={{ fontSize: '1rem', color: expertTickerData.fundamentals.roe > 15 ? '#10b981' : '#fff' }}>
                               {expertTickerData.fundamentals.roe.toFixed(1)}%
                             </strong>
                           </div>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>PEG Ratio</p>
                             <strong style={{ fontSize: '1rem', color: (expertTickerData.fundamentals.peg_ratio > 0 && expertTickerData.fundamentals.peg_ratio < 1.5) ? '#10b981' : expertTickerData.fundamentals.peg_ratio > 3 ? '#ef4444' : '#fff' }}>
                               {expertTickerData.fundamentals.peg_ratio ? expertTickerData.fundamentals.peg_ratio.toFixed(2) : 'N/A'}
                             </strong>
                           </div>
                         </div>
                       </div>
                     )}

                     {expertTickerData.news && expertTickerData.news.length > 0 && (
                       <div className="neo-panel" style={{ marginTop: '1.5rem' }}>
                         <h3 style={{ margin: '0 0 1rem 0', color: '#ec4899', borderBottom: '1px solid #27272a', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                           <Radio size={18} className="pulse" /> Live News Feed
                         </h3>
                         <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                           {expertTickerData.news.map((headline, i) => (
                             <li key={i} style={{ marginBottom: '1rem', color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.4', borderBottom: i !== expertTickerData.news.length - 1 ? '1px dashed rgba(255,255,255,0.1)' : 'none', paddingBottom: i !== expertTickerData.news.length - 1 ? '1rem' : 0 }}>
                               <span style={{ color: '#ec4899', marginRight: '5px' }}>▶</span> {headline}
                             </li>
                           ))}
                         </ul>
                       </div>
                     )}
                   </div>
                 </div>
               </div>
            ) : isSearching ? (
               <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#00F0FF", width: "100%" }} className="glass-card">
                 <Loader size={48} className="spin" style={{ marginBottom: "1rem" }} />
                 <h3>Fetching Pro Terminal Data & Technicals...</h3>
               </div>
            ) : (
               <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: searchError ? "#ef4444" : "#4facfe", width: "100%", gap: "10px" }} className="glass-card">
                 <Search size={48} style={{marginBottom: "1rem", opacity: 0.5}} />
                 <h3>{searchError ? searchError : "No Ticker Selected"}</h3>
                 <p style={{color: "#94a3b8"}}>{searchError ? "Please check backend connection." : "Select a ticker below to view its Deep Chart immediately:"}</p>
                 <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                   {["SPY", "QQQ", "NVDA", "TSLA", "AAPL"].map(sym => (
                     <button key={sym} onClick={() => fetchTickerData(sym)} style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "6px 14px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                       Load {sym}
                     </button>
                   ))}
                 </div>
               </div>
            )}
        </div>
      )}

      {activeTab === 'intraday' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem', borderTop: '5px solid #ec4899' }}>
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ec4899' }}>
              <Radio className="spin-slow" /> Live Intraday Options Radar
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Scanning High-Beta Mega Caps for 15-Min Opening Range Breakouts paired with massive Call Volume &gt; Put Volume flow.
            </p>
            
            {intradayLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#ec4899' }}>
                <Loader size={48} className="spin" style={{ marginBottom: '1rem' }} />
                <h3>Scanning Options Chains... (This takes a few seconds)</h3>
              </div>
            ) : intradayData && intradayData.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                {intradayData.map((alert, i) => (
                  <div key={i} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #10b981', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => fetchTickerData(alert.ticker)} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.01)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                    <div>
                      <h2 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '2rem' }}>{alert.ticker}</h2>
                      <div style={{ color: '#10b981', fontWeight: 'bold' }}>
                        Broke 15m ORB Pivot: ${alert.orb_pivot.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginRight: '10px' }}>Current Price</span>
                        <strong style={{ fontSize: '1.2rem' }}>${alert.current_price.toFixed(2)}</strong>
                      </div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginRight: '10px' }}>Vol Multiplier</span>
                        <strong style={{ color: alert.vol_multiplier > 2 ? '#10b981' : '#f59e0b' }}>{alert.vol_multiplier.toFixed(1)}x Avg</strong>
                      </div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginRight: '10px' }}>Call/Put Vol Ratio</span>
                        <strong style={{ color: alert.call_put_ratio > 2 ? '#10b981' : '#ec4899' }}>{alert.call_put_ratio.toFixed(2)}x</strong>
                      </div>
                      <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginRight: '10px' }}>VWAP Trend Velocity</span>
                        <strong style={{ background: alert.vwap_slope > 0.1 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: alert.vwap_slope > 0.1 ? '#10b981' : '#ef4444', padding: '2px 8px', borderRadius: '4px', fontSize: '0.9rem' }}>
                          {alert.vwap_slope !== undefined ? `${alert.vwap_slope > 0 ? '+' : ''}${alert.vwap_slope.toFixed(2)}%` : 'N/A'}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginRight: '10px' }}>Institutional Block HVN</span>
                        <strong style={{ color: '#3b82f6', borderBottom: '1px dashed #3b82f6' }}>
                          ${alert.hvn_proxy !== undefined ? alert.hvn_proxy.toFixed(2) : 'N/A'}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                <AlertCircle size={48} color="#f59e0b" style={{ marginBottom: '1rem' }} />
                <h3>No Intraday Breakouts Found</h3>
                <p style={{ color: '#94a3b8' }}>None of the high-beta stocks are currently breaking their 15-minute ORB with heavy Call flow.</p>
              </div>
            )}
          </div>
        </div>
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

      {/* Static Right Pane (Live Agents & Ask AI) */}
      <div className="right-pane" style={{ padding: '1.5rem' }}>
        
        {/* Live Agent / Sweeps Feed - ALWAYS VISIBLE */}
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
      </div>

    </div> {/* End app-layout */}
    </>
  )
}

export default App
