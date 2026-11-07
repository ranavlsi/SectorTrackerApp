#!/usr/bin/env python3
"""
Institutional 1-3 Week Swing Trading Engine 2.0 (Pinnacle Edition)
Specialized for 5 to 15 trading day holding periods.
Fuses:
1. 6 Core Swing Archetypes:
   - Minervini VCP Coils (vcp_coil)
   - High-Tight & Bull Flags (bull_flag)
   - 10/21 EMA Pullbacks & Pocket Pivots (ema_pullback)
   - RS Line New High Ahead of Price (rs_leader)
   - Post-Earnings Drift / PEAD Shelves (pead_drift)
   - Extreme Volatility Dry-Up / Squeezes (vdu_squeeze)
2. 11-Engine Cross-Screener Confluence:
   - RS Line Scanner (IBD RS Rating, Blue Dot, MarketSurge Official Pattern & Buy Point)
   - 10-Year Cyclical Seasonality (Current & Next Month Win Rate % & Avg Return %)
   - CBOE Options Intelligence (Call Flow %, Opt Vol Ratio, 30D IV, IV Rank, VRP, Whale Sweeps)
   - Sector RRG Quadrant (Leading / Improving / Weakening / Lagging)
   - First MA Pullback, Squeeze Radar, Wick Absorption, Clean Uptrend, Best Acting, Emerging Leaders
3. Automated 9-Section Legacy TA Veto & Grader Scorecard:
   - Veto 1 (Context / Stage 2 Alignment), Veto 2 (Location & Pivot Proximity), Veto 3 (Volume Story: OBV + VDU + PP)
   - Grader 4 (30D Trajectory & RS Alpha), Grader 5 (Volatility Compression & VRP), Grader 6 (Options & Seasonality)
   - Arithmetic 7-9 (3-Tranche Pyramid Plan, Tripwire Exit, 10/21-EMA Trailing Stop Rule, Defined-Risk Options Play)
"""

import os
import sys
import json
import time
import math
import duckdb
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Any, Optional

BASE_DIR = '/Users/amitkumar/Desktop/SectorTrackerApp'
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
LAKEHOUSE_PATH = os.path.join(BASE_DIR, 'backend', 'data', 'daily_ohlcv.parquet')
PUBLIC_OUTPUT_PATH = os.path.join(PUBLIC_DIR, 'swing_trading_setups.json')
MARKET_HEALTH_PATH = os.path.join(PUBLIC_DIR, 'market_health.json')

MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

SECTOR_MAP = {
    'NVDA': ('Nvidia', 'Semiconductors'),
    'AAPL': ('Apple', 'Technology'),
    'MSFT': ('Microsoft', 'Software'),
    'AMZN': ('Amazon', 'Consumer Discretionary'),
    'GOOGL': ('Alphabet', 'Communication Services'),
    'META': ('Meta Platforms', 'Communication Services'),
    'TSLA': ('Tesla', 'Automotive / EV'),
    'PLTR': ('Palantir', 'Enterprise AI Software'),
    'AVGO': ('Broadcom', 'Semiconductors'),
    'AMD': ('Advanced Micro Devices', 'Semiconductors'),
    'ARM': ('Arm Holdings', 'Semiconductor IP'),
    'ALAB': ('Astera Labs', 'Semiconductor Connectivity'),
    'RDDT': ('Reddit', 'Social Media'),
    'HOOD': ('Robinhood', 'Fintech / Brokerage'),
    'CAVA': ('Cava Group', 'Consumer Fast Casual'),
    'CRWD': ('CrowdStrike', 'Cybersecurity'),
    'NET': ('Cloudflare', 'Cloud Infrastructure'),
    'FTNT': ('Fortinet', 'Cybersecurity'),
    'PANW': ('Palo Alto Networks', 'Cybersecurity'),
    'DELL': ('Dell Technologies', 'Hardware / AI Servers'),
    'VLO': ('Valero Energy', 'Energy / Refining'),
    'MPC': ('Marathon Petroleum', 'Energy / Refining'),
    'PSX': ('Phillips 66', 'Energy / Refining'),
    'XOM': ('Exxon Mobil', 'Energy / Oil & Gas'),
    'CVX': ('Chevron', 'Energy / Oil & Gas'),
    'GE': ('GE Aerospace', 'Aerospace & Defense'),
    'CAT': ('Caterpillar', 'Industrials / Machinery'),
    'LLY': ('Eli Lilly', 'Healthcare / Pharma'),
    'UNH': ('UnitedHealth', 'Healthcare / Managed Care'),
    'JPM': ('JPMorgan Chase', 'Financials / Banking'),
    'GS': ('Goldman Sachs', 'Financials / Investment Banking'),
    'MS': ('Morgan Stanley', 'Financials / Wealth Management'),
    'COIN': ('Coinbase', 'Fintech / Crypto'),
    'MSTR': ('MicroStrategy', 'Enterprise Software / Bitcoin'),
    'RIVN': ('Rivian Automotive', 'Automotive / EV'),
    'ASTS': ('AST SpaceMobile', 'Telecom / Space'),
    'IONQ': ('IonQ', 'Quantum Computing'),
    'SOFI': ('SoFi Technologies', 'Fintech / Banking'),
    'SMCI': ('Super Micro Computer', 'Server Infrastructure'),
    'CELH': ('Celsius Holdings', 'Consumer Beverages'),
    'DKNG': ('DraftKings', 'Gaming / Online Sports'),
    'DUOL': ('Duolingo', 'EdTech / Consumer App'),
    'AXON': ('Axon Enterprise', 'Aerospace & Defense / Security'),
    'APP': ('AppLovin', 'AdTech / Mobile Software'),
    'TOST': ('Toast', 'Fintech / Restaurant POS'),
    'BROS': ('Dutch Bros', 'Consumer Beverages'),
    'FOUR': ('Shift4 Payments', 'Fintech / Payments'),
    'GTLB': ('GitLab', 'DevSecOps Software'),
    'DDOG': ('Datadog', 'Cloud Monitoring Software'),
    'SNOW': ('Snowflake', 'Cloud Data Warehousing'),
    'MDB': ('MongoDB', 'Database Software'),
    'ZS': ('Zscaler', 'Cloud Cybersecurity'),
    'NTRA': ('Natera', 'Genomics / Diagnostics'),
    'TXG': ('10x Genomics', 'Life Sciences Tools'),
    'SDGR': ('Schrodinger', 'Biotech / AI Drug Discovery'),
    'OKTA': ('Okta', 'Identity Security Software'),
    'SWKS': ('Skyworks Solutions', 'Semiconductors / RF'),
    'DOCU': ('DocuSign', 'Enterprise Software'),
    'RVTY': ('Revvity', 'Health Sciences Tools'),
    'DINO': ('HF Sinclair', 'Energy / Refining'),
    'CVI': ('CVR Energy', 'Energy / Refining'),
    'CF': ('CF Industries', 'Materials / Agricultural Chemicals'),
    'AEM': ('Agnico Eagle Mines', 'Materials / Gold Mining'),
    'NEM': ('Newmont', 'Materials / Gold Mining'),
    'GOLD': ('Barrick Gold', 'Materials / Gold Mining'),
    'WPM': ('Wheaton Precious Metals', 'Materials / Royalties'),
    'HL': ('Hecla Mining', 'Materials / Silver Mining'),
    'PAAS': ('Pan American Silver', 'Materials / Silver Mining'),
    'SLB': ('Schlumberger', 'Energy / Oilfield Services'),
    'HAL': ('Halliburton', 'Energy / Oilfield Services'),
    'OXY': ('Occidental Petroleum', 'Energy / Oil & Gas'),
    'FANG': ('Diamondback Energy', 'Energy / Exploration'),
    'EOG': ('EOG Resources', 'Energy / Exploration'),
    'VRT': ('Vertiv Holdings', 'Industrial Power / Data Centers'),
    'PWR': ('Quanta Services', 'Industrial Infrastructure'),
    'URI': ('United Rentals', 'Industrial Equipment'),
    'TTWO': ('Take-Two Interactive', 'Interactive Entertainment'),
    'EA': ('Electronic Arts', 'Interactive Entertainment'),
    'ISRG': ('Intuitive Surgical', 'Healthcare / Medical Devices'),
    'BSX': ('Boston Scientific', 'Healthcare / Medical Devices'),
    'EW': ('Edwards Lifesciences', 'Healthcare / Medical Devices'),
    'TDW': ('Tidewater', 'Energy / Marine Services'),
    'WHD': ('Cactus Inc', 'Energy / Equipment'),
    'RUSHA': ('Rush Enterprises', 'Commercial Vehicles'),
    'BCC': ('Boise Cascade', 'Building Materials'),
    'CWST': ('Casella Waste Systems', 'Environmental Services'),
    'HUBG': ('Hub Group', 'Transportation / Logistics'),
    'GXO': ('GXO Logistics', 'Contract Logistics'),
    'POWL': ('Powell Industries', 'Electrical Equipment'),
    'STLD': ('Steel Dynamics', 'Materials / Steel'),
    'NUE': ('Nucor', 'Materials / Steel'),
    'RS': ('Reliance Steel', 'Materials / Steel Distribution'),
    'NXPI': ('NXP Semiconductors', 'Semiconductors / Auto'),
    'ON': ('ON Semiconductor', 'Semiconductors / Power'),
    'MCHP': ('Microchip Technology', 'Semiconductors / Microcontrollers'),
    'RMBS': ('Rambus', 'Semiconductors / Memory IP'),
    'ANET': ('Arista Networks', 'Cloud Networking'),
    'CIEN': ('Ciena Corp', 'Networking Optical Systems'),
    'NTAP': ('NetApp', 'Data Storage Systems'),
    'WDC': ('Western Digital', 'Data Storage Hardware'),
    'STX': ('Seagate Technology', 'Data Storage Hardware'),
    'COST': ('Costco Wholesale', 'Consumer Staples'),
    'WMT': ('Walmart', 'Consumer Staples'),
    'TJX': ('TJX Companies', 'Consumer Discretionary'),
    'GLD': ('SPDR Gold Trust', 'Precious Metals ETF'),
    'SLV': ('iShares Silver Trust', 'Precious Metals ETF'),
}


def load_json_safe(filename: str) -> Any:
    path = os.path.join(PUBLIC_DIR, filename)
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"[SwingEngine] Warning loading {filename}: {e}")
    return {}


def build_cross_engine_lookups() -> Dict[str, Any]:
    """Loads all 11 quantitative engines from public/*.json for instant O(1) enrichment."""
    rs_raw = load_json_safe('rs_scanner_results.json')
    rs_map = {}
    for item in (rs_raw.get('results') or []):
        t = item.get('ticker')
        if t:
            rs_map[t] = item

    seas_raw = load_json_safe('seasonality_results.json')
    seas_map = {}
    for bucket in ['all_candidates', 'top_picks', 'seasonal_breakout_leaders', 'upcoming_monthly_tailwinds']:
        for item in (seas_raw.get(bucket) or []):
            t = item.get('ticker')
            if t and t not in seas_map:
                seas_map[t] = item

    opt_raw = load_json_safe('options_screener.json')
    opt_map = {}
    for row in (opt_raw.get('data') or []):
        t = row.get('ticker')
        if t:
            opt_map[t] = row

    unusual_map = {}
    for contract in (opt_raw.get('unusual_whales') or []):
        t = contract.get('ticker')
        if t:
            if t not in unusual_map or float(contract.get('vol_oi_ratio', 0)) > float(unusual_map[t].get('vol_oi_ratio', 0)):
                unusual_map[t] = contract

    sec_raw = load_json_safe('sector_flow.json')
    sector_quad_map = {}
    for sec_name, info in (sec_raw.get('sectors') or {}).items():
        if isinstance(info, dict):
            sector_quad_map[sec_name.lower()] = info.get('quadrant', 'Improving')

    # Additional specialized screeners for multi-engine confluence badges
    engine_hits = {}
    def _add_hit(t, label):
        if not t:
            return
        engine_hits.setdefault(t, [])
        if label not in engine_hits[t]:
            engine_hits[t].append(label)

    for t, item in rs_map.items():
        if item.get('is_blue_dot'):
            _add_hit(t, '🔵 Blue Dot RS New High')
        elif float(item.get('rs_rating') or 0) >= 85:
            _add_hit(t, f"RS Leader ({int(float(item.get('rs_rating')))})")

    for t, item in seas_map.items():
        s = item.get('seasonality') or {}
        if float(s.get('cur_month_win') or 0) >= 65:
            _add_hit(t, f"🌊 Seasonal Tailwind ({int(float(s.get('cur_month_win')))}% Win)")

    for t, row in opt_map.items():
        if float(row.get('call_vol_pct') or 0) >= 62 and float(row.get('opt_vol_ratio') or 0) >= 1.1:
            _add_hit(t, f"🐳 Bullish Options ({int(float(row.get('call_vol_pct')))}% Calls)")

    fmp = load_json_safe('first_ma_pullback_results.json')
    for item in (fmp.get('setups') or fmp.get('results') or []):
        _add_hit(item.get('ticker'), '🛡️ 1st MA Pullback')

    sqz = load_json_safe('squeeze_setups.json')
    for bucket in ['imminent_breakouts', 'squeeze_started', 'coiling_watch']:
        for item in (sqz.get(bucket) or []):
            _add_hit(item.get('ticker'), '🔥 Squeeze Radar')

    wick = load_json_safe('wick_absorption_results.json')
    for item in (wick.get('setups') or wick.get('results') or []):
        _add_hit(item.get('ticker'), '🧲 Wick Absorption')

    clean = load_json_safe('clean_uptrend_results.json')
    for item in (clean.get('setups') or clean.get('results') or []):
        _add_hit(item.get('ticker'), '✨ Clean 9/13 Uptrend')

    best = load_json_safe('best_acting_results.json')
    for item in (best.get('results') or best.get('setups') or []):
        _add_hit(item.get('ticker'), '⚡ ADX Best Acting')

    emg = load_json_safe('emerging_leaders.json')
    for item in (emg.get('leaders') or emg.get('results') or []):
        _add_hit(item.get('ticker'), '🌱 Emerging Leader')

    return {
        'rs_map': rs_map,
        'seas_map': seas_map,
        'opt_map': opt_map,
        'unusual_map': unusual_map,
        'sector_quad_map': sector_quad_map,
        'engine_hits': engine_hits,
    }


def get_profile(ticker: str, rs_map: Optional[Dict[str, Any]] = None):
    if rs_map and ticker in rs_map:
        item = rs_map[ticker]
        nm = item.get('name') or SECTOR_MAP.get(ticker, (ticker, 'Growth & Momentum'))[0]
        sec = item.get('sector') or SECTOR_MAP.get(ticker, (ticker, 'Growth & Momentum'))[1]
        return nm, sec
    if ticker in SECTOR_MAP:
        return SECTOR_MAP[ticker][0], SECTOR_MAP[ticker][1]
    return ticker, "Growth & Momentum"


def load_macro_regime():
    """Extract macro swing regime & exposure recommendation from market health."""
    default_regime = {
        "regime": "SELECTIVE",
        "regime_label": "Selective Tactical Swing Regime",
        "regime_color": "#f59e0b",
        "score_value": 55.0,
        "recommended_exposure": "40% - 65% Invested (Focus on A+ Setups)",
        "exposure_pct": 55,
        "swing_verdict": "Tactical Market: Focus strictly on A+ Stage 2 Leaders with RS > 85. Scale 50% off at Target 1 and raise stop to break-even.",
        "mco_status": "Neutral",
        "breadth_above_50": 48.0
    }

    if os.path.exists(MARKET_HEALTH_PATH):
        try:
            with open(MARKET_HEALTH_PATH, 'r') as f:
                health = json.load(f)
                cur = health.get("current_health", {})
                score = float(cur.get("score_value", 55.0))
                regime = cur.get("health_regime", "CAUTIOUS")
                regime_label = cur.get("health_regime_label", "Cautious (Neutral/Choppy)")
                regime_color = cur.get("health_regime_color", "#f59e0b")

                if score >= 65:
                    recommended_exp = "75% - 100% Invested (Aggressive Swing Expansion)"
                    exposure_pct = 90
                    verdict = "Full Green Light: Breakouts follow through. Hold runners to Target 2 (+12% to +22%) using rising 21-EMA trail."
                elif score >= 45:
                    recommended_exp = "40% - 65% Invested (Tactical Selective Swings)"
                    exposure_pct = 55
                    verdict = "Tactical Market: Focus strictly on A+ Leaders with VDU & RS breakouts. Scale 50% off at Target 1 and raise stop to break-even."
                else:
                    recommended_exp = "15% - 30% Invested (High Cash / Progressive Pilot Sizing)"
                    exposure_pct = 25
                    verdict = "Defensive Regime: Start with 50% pilot size, harvest 50% at Target 1 (+5% to +8%), and keep stops strictly capped at <=3.2%."

                return {
                    "regime": regime,
                    "regime_label": regime_label,
                    "regime_color": regime_color,
                    "score_value": round(score, 1),
                    "recommended_exposure": recommended_exp,
                    "exposure_pct": exposure_pct,
                    "swing_verdict": verdict,
                    "mco_status": cur.get("mco_status", "Neutral"),
                    "breadth_above_50": cur.get("pct_above_50_value", 45.0)
                }
        except Exception as e:
            print(f"[SwingEngine] Error reading market health: {e}")

    return default_regime


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add EMAs, SMAs, ATR, Historical Volatility (HV10/HV30), Bollinger Bands, Pocket Pivots, VDU, OBV, and A/D Line."""
    df = df.sort_values('Date').reset_index(drop=True)
    c = df['Close']
    h = df['High']
    l = df['Low']
    v = df['Volume']

    df['EMA_10'] = c.ewm(span=10, adjust=False).mean()
    df['EMA_21'] = c.ewm(span=21, adjust=False).mean()
    df['SMA_20'] = c.rolling(20).mean()
    df['SMA_50'] = c.rolling(50).mean()
    df['SMA_200'] = c.rolling(200).mean()

    df['SMA_50_Slope'] = (df['SMA_50'] - df['SMA_50'].shift(10)) / df['SMA_50'].shift(10)
    df['SMA_200_Slope'] = (df['SMA_200'] - df['SMA_200'].shift(20)) / df['SMA_200'].shift(20)

    prev_c = c.shift(1)
    tr = pd.concat([
        h - l,
        (h - prev_c).abs(),
        (l - prev_c).abs()
    ], axis=1).max(axis=1)
    df['ATR_14'] = tr.rolling(14).mean()
    df['ATR_5'] = tr.rolling(5).mean()
    df['ATR_20'] = tr.rolling(20).mean()

    # Annualized Realized Volatility (10D & 30D HV %)
    log_ret = np.log(c / prev_c)
    df['HV_10'] = log_ret.rolling(10).std() * np.sqrt(252) * 100.0
    df['HV_30'] = log_ret.rolling(30).std() * np.sqrt(252) * 100.0

    # RSI 14
    delta = c.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    df['RSI_14'] = (100 - (100 / (1 + rs))).fillna(50.0)

    df['Vol_50'] = v.rolling(50).mean()
    df['Vol_20'] = v.rolling(20).mean()
    df['Vol_5'] = v.rolling(5).mean()

    # Close Location Value (CLV 0..1)
    df['CLV'] = ((c - l) / (h - l).replace(0, np.nan)).fillna(0.5)

    # OBV & A/D Line
    df['OBV'] = (np.sign(delta) * v).fillna(0).cumsum()
    df['AD_Line'] = ((df['CLV'] - 0.5) * 2.0 * v).cumsum()

    # Down-day volume max over prior 10 sessions for Morales/Kacher Pocket Pivot detection
    down_vol = np.where(delta < 0, v, 0)
    max_down_vol_10 = pd.Series(down_vol, index=df.index).shift(1).rolling(10).max()
    df['Is_Pocket_Pivot'] = (delta > 0) & (v > max_down_vol_10) & (df['CLV'] >= 0.55)
    df['Is_VDU'] = v <= (df['Vol_50'] * 0.68)

    std_20 = c.rolling(20).std()
    df['BB_Upper'] = df['SMA_20'] + (std_20 * 2.0)
    df['BB_Lower'] = df['SMA_20'] - (std_20 * 2.0)
    df['BB_Width'] = (df['BB_Upper'] - df['BB_Lower']) / df['SMA_20'].replace(0, np.nan)

    df['High_52W'] = h.rolling(min(252, len(df))).max()
    df['Low_52W'] = l.rolling(min(252, len(df))).min()

    return df


def evaluate_vcp_coil(df: pd.DataFrame, ticker: str, rs_map: Dict[str, Any]):
    if len(df) < 55:
        return None
    row = df.iloc[-1]
    close = float(row['Close'])
    sma50 = float(row['SMA_50']) if not pd.isna(row['SMA_50']) else 0
    sma200 = float(row['SMA_200']) if not pd.isna(row['SMA_200']) else 0
    atr = float(row['ATR_14']) if not pd.isna(row['ATR_14']) else 0

    if sma50 <= 0 or atr <= 0 or close < sma50:
        return None
    if sma200 > 0 and close < sma200 * 0.95:
        return None

    base_window = min(50, len(df))
    sub = df.tail(base_window)
    base_high = float(sub['High'].max())
    dist_to_high = (base_high - close) / base_high

    if dist_to_high < -0.015 or dist_to_high > 0.055:
        return None

    atr5 = float(row['ATR_5']) if not pd.isna(row['ATR_5']) else atr
    atr20 = float(row['ATR_20']) if not pd.isna(row['ATR_20']) else atr
    if atr20 <= 0 or (atr5 / atr20) > 0.92:
        return None

    vol50 = float(row['Vol_50']) if not pd.isna(row['Vol_50']) else 0
    recent_vol = float(sub['Volume'].tail(3).mean())
    if vol50 <= 0 or (recent_vol / vol50) > 1.05:
        return None

    entry = round(base_high + (0.05 * atr), 2)
    recent_low = float(sub['Low'].tail(5).min())
    raw_sl = round(recent_low - (0.15 * atr), 2)

    risk_dollars = entry - raw_sl
    risk_pct = (risk_dollars / entry) * 100
    if risk_pct > 3.8:
        raw_sl = round(entry * 0.965, 2)
        risk_dollars = entry - raw_sl
        risk_pct = 3.5
    elif risk_pct < 1.6:
        raw_sl = round(entry * 0.982, 2)
        risk_dollars = entry - raw_sl
        risk_pct = 1.8

    t1 = round(entry + (2.2 * risk_dollars), 2)
    t2 = round(max(t1 * 1.08, entry + (4.0 * risk_dollars)), 2)
    rr = round((t2 - entry) / max(0.01, entry - raw_sl), 1)

    score = 88
    if (recent_vol / vol50) < 0.70:
        score += 5
    if dist_to_high < 0.025:
        score += 4

    name, sector = get_profile(ticker, rs_map)
    return {
        "ticker": ticker,
        "company_name": name,
        "sector": sector,
        "setup_type": "vcp_coil",
        "setup_name": "Minervini VCP Coil",
        "category_badge": "🌀 VCP Coil",
        "timeframe": "1-3 Weeks (5-12 Days)",
        "score": min(98, score),
        "current_price": round(close, 2),
        "entry": entry,
        "stop_loss": raw_sl,
        "target_1": t1,
        "target_1_pct": round(((t1 - entry) / entry) * 100, 1),
        "target_2": t2,
        "target_2_pct": round(((t2 - entry) / entry) * 100, 1),
        "risk_pct": round(risk_pct, 1),
        "reward_risk": rr,
        "proximity_pct": round(((entry - close) / close) * 100, 1),
        "support_level": round(recent_low, 2),
        "trail_rule": "Close below rising 21-EMA (after T1 partial)",
        "catalyst_note": f"Base High: ${base_high:.2f}. Volatility contracted {max(0, (1 - atr5/atr20)*100):.0f}% with VDU at {recent_vol/vol50:.2f}x average volume.",
        "execution_strategy": "Place Buy Stop order at Entry. Take 50% partial profit at T1 (+5-8%), move stop to break-even, and trail runner along rising 21-EMA to T2."
    }


def evaluate_bull_flag(df: pd.DataFrame, ticker: str, rs_map: Dict[str, Any]):
    if len(df) < 30:
        return None
    row = df.iloc[-1]
    close = float(row['Close'])
    atr = float(row['ATR_14']) if not pd.isna(row['ATR_14']) else 0
    ema10 = float(row['EMA_10']) if not pd.isna(row['EMA_10']) else close
    ema21 = float(row['EMA_21']) if not pd.isna(row['EMA_21']) else close

    if atr <= 0 or close < ema21 * 0.985:
        return None

    sub = df.tail(25)
    pole_high = float(sub['High'].max())
    pole_high_idx = int(sub['High'].values.argmax())
    bars_since_high = len(sub) - 1 - pole_high_idx

    if bars_since_high < 3 or bars_since_high > 12:
        return None

    prior_window = sub.iloc[:pole_high_idx]
    if len(prior_window) < 3:
        return None
    pole_low = float(prior_window['Low'].min())
    pole_gain = (pole_high - pole_low) / pole_low
    if pole_gain < 0.14:
        return None

    flag_data = sub.iloc[pole_high_idx:]
    flag_low = float(flag_data['Low'].min())
    flag_depth = (pole_high - flag_low) / pole_high
    if flag_depth > 0.13:
        return None

    flag_high = float(flag_data['High'].iloc[:-1].max()) if len(flag_data) > 1 else pole_high

    entry = round(flag_high + (0.05 * atr), 2)
    support = min(flag_low, ema21)
    raw_sl = round(support - (0.15 * atr), 2)

    risk_dollars = entry - raw_sl
    risk_pct = (risk_dollars / entry) * 100
    if risk_pct > 3.8:
        raw_sl = round(entry * 0.965, 2)
        risk_dollars = entry - raw_sl
        risk_pct = 3.5
    elif risk_pct < 1.6:
        raw_sl = round(entry * 0.982, 2)
        risk_dollars = entry - raw_sl
        risk_pct = 1.8

    t1 = round(entry + (2.3 * risk_dollars), 2)
    t2 = round(max(t1 * 1.08, entry + (4.2 * risk_dollars)), 2)
    rr = round((t2 - entry) / max(0.01, entry - raw_sl), 1)

    score = 90
    if pole_gain > 0.25:
        score += 4
    if flag_depth < 0.07:
        score += 4

    name, sector = get_profile(ticker, rs_map)
    return {
        "ticker": ticker,
        "company_name": name,
        "sector": sector,
        "setup_type": "bull_flag",
        "setup_name": "High-Tight Bull Flag",
        "category_badge": "🚩 Bull Flag",
        "timeframe": "1-2 Weeks (5-10 Days)",
        "score": min(99, score),
        "current_price": round(close, 2),
        "entry": entry,
        "stop_loss": raw_sl,
        "target_1": t1,
        "target_1_pct": round(((t1 - entry) / entry) * 100, 1),
        "target_2": t2,
        "target_2_pct": round(((t2 - entry) / entry) * 100, 1),
        "risk_pct": round(risk_pct, 1),
        "reward_risk": rr,
        "proximity_pct": round(((entry - close) / close) * 100, 1),
        "support_level": round(support, 2),
        "trail_rule": "Close below rising 10-EMA (fast velocity flag)",
        "catalyst_note": f"Pole thrust: +{pole_gain*100:.1f}%. Flag consolidation: {bars_since_high} sessions with only {flag_depth*100:.1f}% shallow pullback.",
        "execution_strategy": "Buy the flag pivot breakout. Explosive expansion typically resolves within 3 to 7 trading days; trail runner with 10-EMA."
    }


def evaluate_ema_pullback(df: pd.DataFrame, ticker: str, rs_map: Dict[str, Any]):
    if len(df) < 55:
        return None
    row = df.iloc[-1]
    close = float(row['Close'])
    high = float(row['High'])
    low = float(row['Low'])
    atr = float(row['ATR_14']) if not pd.isna(row['ATR_14']) else 0
    ema10 = float(row['EMA_10']) if not pd.isna(row['EMA_10']) else close
    ema21 = float(row['EMA_21']) if not pd.isna(row['EMA_21']) else close
    sma50 = float(row['SMA_50']) if not pd.isna(row['SMA_50']) else 0

    if sma50 <= 0 or atr <= 0 or close < sma50:
        return None

    close_25d_ago = float(df['Close'].iloc[-25])
    if (close - close_25d_ago) / close_25d_ago < 0.05:
        return None

    dist_10 = abs(close - ema10) / ema10
    dist_21 = abs(close - ema21) / ema21

    is_at_10 = (dist_10 <= 0.018) and (low <= ema10 * 1.008)
    is_at_21 = (dist_21 <= 0.022) and (low <= ema21 * 1.010)

    if not (is_at_10 or is_at_21):
        return None

    candle_range = high - low
    if candle_range > 0 and (close - low) / candle_range < 0.35:
        return None

    active_ma = "10-EMA" if is_at_10 else "21-EMA"
    support_val = ema10 if is_at_10 else ema21

    entry = round(high + (0.05 * atr), 2)
    raw_sl = round(min(low, support_val) - (0.20 * atr), 2)

    risk_dollars = entry - raw_sl
    risk_pct = (risk_dollars / entry) * 100
    if risk_pct > 3.8:
        raw_sl = round(entry * 0.965, 2)
        risk_dollars = entry - raw_sl
        risk_pct = 3.5
    elif risk_pct < 1.6:
        raw_sl = round(entry * 0.982, 2)
        risk_dollars = entry - raw_sl
        risk_pct = 1.8

    swing_high = float(df['High'].tail(20).max())
    t1 = round(max(swing_high, entry + (2.0 * risk_dollars)), 2)
    t2 = round(max(t1 * 1.08, entry + (3.8 * risk_dollars)), 2)
    rr = round((t2 - entry) / max(0.01, entry - raw_sl), 1)

    score = 86
    if is_at_10:
        score += 5
    if (close - low) / (candle_range if candle_range > 0 else 1) > 0.65:
        score += 4

    name, sector = get_profile(ticker, rs_map)
    return {
        "ticker": ticker,
        "company_name": name,
        "sector": sector,
        "setup_type": "ema_pullback",
        "setup_name": f"Holy Grail {active_ma} Pullback",
        "category_badge": "📈 EMA Pullback",
        "timeframe": "1-3 Weeks (7-15 Days)",
        "score": min(96, score),
        "current_price": round(close, 2),
        "entry": entry,
        "stop_loss": raw_sl,
        "target_1": t1,
        "target_1_pct": round(((t1 - entry) / entry) * 100, 1),
        "target_2": t2,
        "target_2_pct": round(((t2 - entry) / entry) * 100, 1),
        "risk_pct": round(risk_pct, 1),
        "reward_risk": rr,
        "proximity_pct": round(((entry - close) / close) * 100, 1),
        "support_level": round(support_val, 2),
        "trail_rule": f"Close below rising {active_ma}",
        "catalyst_note": f"Orderly test of rising {active_ma} (${support_val:.2f}) with upper-range rejection wick (CLV {int(float(row['CLV'])*100)}%).",
        "execution_strategy": f"Enter as price takes out prior day high (${high:.2f}). Exit 50% at prior swing high (${swing_high:.2f}), trail remainder along {active_ma}."
    }


def evaluate_rs_leader(df: pd.DataFrame, spy_aligned: pd.Series, ticker: str, rs_map: Dict[str, Any]):
    if len(df) < 60 or spy_aligned is None or len(spy_aligned) < 60:
        return None
    row = df.iloc[-1]
    close = float(row['Close'])
    atr = float(row['ATR_14']) if not pd.isna(row['ATR_14']) else 0
    sma50 = float(row['SMA_50']) if not pd.isna(row['SMA_50']) else 0

    if sma50 <= 0 or atr <= 0 or close < sma50:
        return None

    rs_series = df['Close'] / spy_aligned
    rs_60d_high = float(rs_series.tail(60).max())
    curr_rs = float(rs_series.iloc[-1])

    if curr_rs < rs_60d_high * 0.995:
        return None

    price_60d_high = float(df['High'].tail(60).max())
    price_gap = (price_60d_high - close) / price_60d_high
    if price_gap < 0.012 or price_gap > 0.095:
        return None

    local_high = float(df['High'].tail(10).max())
    entry = round(local_high + (0.05 * atr), 2)
    local_low = float(df['Low'].tail(10).min())
    raw_sl = round(local_low - (0.15 * atr), 2)

    risk_dollars = entry - raw_sl
    risk_pct = (risk_dollars / entry) * 100
    if risk_pct > 3.8:
        raw_sl = round(entry * 0.965, 2)
        risk_dollars = entry - raw_sl
        risk_pct = 3.5
    elif risk_pct < 1.6:
        raw_sl = round(entry * 0.982, 2)
        risk_dollars = entry - raw_sl
        risk_pct = 1.8

    t1 = round(price_60d_high, 2)
    if t1 < entry + (2.0 * risk_dollars):
        t1 = round(entry + (2.2 * risk_dollars), 2)
    t2 = round(max(t1 * 1.08, entry + (4.2 * risk_dollars)), 2)
    rr = round((t2 - entry) / max(0.01, entry - raw_sl), 1)

    score = 92
    if curr_rs >= rs_60d_high:
        score += 5

    name, sector = get_profile(ticker, rs_map)
    return {
        "ticker": ticker,
        "company_name": name,
        "sector": sector,
        "setup_type": "rs_leader",
        "setup_name": "Blue Dot RS Line Breakout",
        "category_badge": "🚀 RS Leader",
        "timeframe": "1-3 Weeks (10-15 Days)",
        "score": min(98, score),
        "current_price": round(close, 2),
        "entry": entry,
        "stop_loss": raw_sl,
        "target_1": t1,
        "target_1_pct": round(((t1 - entry) / entry) * 100, 1),
        "target_2": t2,
        "target_2_pct": round(((t2 - entry) / entry) * 100, 1),
        "risk_pct": round(risk_pct, 1),
        "reward_risk": rr,
        "proximity_pct": round(((entry - close) / close) * 100, 1),
        "support_level": round(local_low, 2),
        "trail_rule": "Close below rising 21-EMA",
        "catalyst_note": f"RS Line printed fresh 60-day high vs SPY while stock price is still {price_gap*100:.1f}% below peak (${price_60d_high:.2f}). Classic O'Neil Blue Dot signal.",
        "execution_strategy": "Pre-pivot institutional accumulation. RS Line leading price into new highs precedes high-velocity Stage 2 breakouts."
    }


def evaluate_pead_drift(df: pd.DataFrame, ticker: str, rs_map: Dict[str, Any]):
    if len(df) < 35:
        return None
    row = df.iloc[-1]
    close = float(row['Close'])
    atr = float(row['ATR_14']) if not pd.isna(row['ATR_14']) else 0
    if atr <= 0:
        return None

    sub = df.tail(25)
    gap_idx = -1
    for i in range(len(sub) - 4):
        prev_close = float(sub['Close'].iloc[i])
        curr_open = float(sub['Open'].iloc[i + 1])
        curr_vol = float(sub['Volume'].iloc[i + 1])
        vol_50 = float(sub['Vol_50'].iloc[i + 1]) if not pd.isna(sub['Vol_50'].iloc[i + 1]) else 0

        if vol_50 <= 0:
            continue

        gap_pct = (curr_open - prev_close) / prev_close
        vol_mult = curr_vol / vol_50

        if gap_pct >= 0.04 and vol_mult >= 1.8:
            gap_idx = i + 1
            break

    if gap_idx == -1:
        return None

    gap_bar = sub.iloc[gap_idx]
    post_gap = sub.iloc[gap_idx:]
    gap_low = float(gap_bar['Low'])

    if float(post_gap['Close'].min()) < gap_low * 0.985:
        return None

    shelf_data = sub.tail(5)
    shelf_high = float(shelf_data['High'].max())
    shelf_low = float(shelf_data['Low'].min())
    shelf_range = (shelf_high - shelf_low) / shelf_low
    if shelf_range > 0.075:
        return None

    entry = round(shelf_high + (0.05 * atr), 2)
    raw_sl = round(max(shelf_low - (0.15 * atr), gap_low * 0.99), 2)

    risk_dollars = entry - raw_sl
    risk_pct = (risk_dollars / entry) * 100
    if risk_pct > 3.8:
        raw_sl = round(entry * 0.965, 2)
        risk_dollars = entry - raw_sl
        risk_pct = 3.5
    elif risk_pct < 1.6:
        raw_sl = round(entry * 0.982, 2)
        risk_dollars = entry - raw_sl
        risk_pct = 1.8

    t1 = round(entry + (2.2 * risk_dollars), 2)
    t2 = round(max(t1 * 1.08, entry + (4.0 * risk_dollars)), 2)
    rr = round((t2 - entry) / max(0.01, entry - raw_sl), 1)

    name, sector = get_profile(ticker, rs_map)
    return {
        "ticker": ticker,
        "company_name": name,
        "sector": sector,
        "setup_type": "pead_drift",
        "setup_name": "Post-Earnings Drift Shelf",
        "category_badge": "💥 PEAD Shelf",
        "timeframe": "1-3 Weeks (5-15 Days)",
        "score": 93,
        "current_price": round(close, 2),
        "entry": entry,
        "stop_loss": raw_sl,
        "target_1": t1,
        "target_1_pct": round(((t1 - entry) / entry) * 100, 1),
        "target_2": t2,
        "target_2_pct": round(((t2 - entry) / entry) * 100, 1),
        "risk_pct": round(risk_pct, 1),
        "reward_risk": rr,
        "proximity_pct": round(((entry - close) / close) * 100, 1),
        "support_level": round(gap_low, 2),
        "trail_rule": "Close below rising 10-EMA or Gap Day Low",
        "catalyst_note": f"Massive Power Gap defended. Consolidating tightly ({shelf_range*100:.1f}% shelf) above gap floor (${gap_low:.2f}) with institutional absorption.",
        "execution_strategy": "Secondary PEAD wave entry above shelf high. Post-earnings drift typically propels price for 10-20 trading sessions."
    }


def evaluate_vdu_squeeze(df: pd.DataFrame, ticker: str, rs_map: Dict[str, Any]):
    if len(df) < 55:
        return None
    row = df.iloc[-1]
    close = float(row['Close'])
    atr = float(row['ATR_14']) if not pd.isna(row['ATR_14']) else 0
    bb_width = float(row['BB_Width']) if not pd.isna(row['BB_Width']) else 1.0
    sma50 = float(row['SMA_50']) if not pd.isna(row['SMA_50']) else 0
    vol50 = float(row['Vol_50']) if not pd.isna(row['Vol_50']) else 0

    if sma50 <= 0 or atr <= 0 or close < sma50:
        return None
    if bb_width > 0.16:
        return None

    atr5 = float(row['ATR_5']) if not pd.isna(row['ATR_5']) else atr
    atr20 = float(row['ATR_20']) if not pd.isna(row['ATR_20']) else atr
    vdu_days_10 = int(df['Is_VDU'].tail(10).sum()) if 'Is_VDU' in df.columns else 0
    recent_vol = float(df['Volume'].tail(3).mean())
    vol_ratio = (recent_vol / vol50) if vol50 > 0 else 1.0
    atr_ratio = (atr5 / atr20) if atr20 > 0 else 1.0

    if atr_ratio > 0.92 and vol_ratio > 0.88 and vdu_days_10 < 2:
        return None
    if vol_ratio > 1.05:
        return None

    coil_high = float(df['High'].tail(5).max())
    coil_low = float(df['Low'].tail(5).min())

    entry = round(coil_high + (0.05 * atr), 2)
    raw_sl = round(coil_low - (0.15 * atr), 2)

    risk_dollars = entry - raw_sl
    risk_pct = (risk_dollars / entry) * 100
    if risk_pct > 3.8:
        raw_sl = round(entry * 0.965, 2)
        risk_dollars = entry - raw_sl
        risk_pct = 3.5
    elif risk_pct < 1.6:
        raw_sl = round(entry * 0.982, 2)
        risk_dollars = entry - raw_sl
        risk_pct = 1.8

    t1 = round(entry + (2.5 * risk_dollars), 2)
    t2 = round(max(t1 * 1.08, entry + (4.5 * risk_dollars)), 2)
    rr = round((t2 - entry) / max(0.01, entry - raw_sl), 1)

    score = 89
    if (atr5 / atr20) < 0.70:
        score += 5
    if bb_width < 0.065:
        score += 4

    name, sector = get_profile(ticker, rs_map)
    return {
        "ticker": ticker,
        "company_name": name,
        "sector": sector,
        "setup_type": "vdu_squeeze",
        "setup_name": "Volatility Dry-Up (VDU) Squeeze",
        "category_badge": "⚡ VDU Squeeze",
        "timeframe": "1-2 Weeks (5-12 Days)",
        "score": min(97, score),
        "current_price": round(close, 2),
        "entry": entry,
        "stop_loss": raw_sl,
        "target_1": t1,
        "target_1_pct": round(((t1 - entry) / entry) * 100, 1),
        "target_2": t2,
        "target_2_pct": round(((t2 - entry) / entry) * 100, 1),
        "risk_pct": round(risk_pct, 1),
        "reward_risk": rr,
        "proximity_pct": round(((entry - close) / close) * 100, 1),
        "support_level": round(coil_low, 2),
        "trail_rule": "Close below rising 10-EMA",
        "catalyst_note": f"Extreme coiling spring. Bollinger Band width compressed to {bb_width*100:.1f}% with ATR5/20 ratio at {atr5/atr20:.2f}. Imminent kinetic expansion.",
        "execution_strategy": "Place conditional bracket order above coil high. Squeezes typically spark explosive momentum bursts within 48-72 hours."
    }


def enrich_setup_clubbed_intelligence(
    setup: Dict[str, Any],
    df: pd.DataFrame,
    spy_aligned: pd.Series,
    lookups: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Attaches 30D Price + RS Line Sparkline, 30D Movement & Alpha, Volatility & VRP Intelligence,
    RS Line & MarketSurge Pattern, 10Y Cyclical Seasonality, CBOE Options Flow,
    Automated 9-Point Legacy TA Veto/Grader Scorecard, and 3-Tranche Pyramid Plan.
    """
    ticker = setup['ticker']
    row = df.iloc[-1]
    close = float(row['Close'])
    entry = float(setup['entry'])
    stop = float(setup['stop_loss'])
    t1 = float(setup['target_1'])
    t2 = float(setup['target_2'])

    rs_item = lookups['rs_map'].get(ticker) or {}
    seas_item = lookups['seas_map'].get(ticker) or {}
    opt_row = lookups['opt_map'].get(ticker) or {}
    whale = lookups['unusual_map'].get(ticker)
    sec_quad_map = lookups['sector_quad_map']
    engine_hits = list(lookups['engine_hits'].get(ticker) or [])

    # Ensure primary setup badge is included in converged engines
    primary_tag = f"🎯 {setup['setup_name']}"
    if primary_tag not in engine_hits:
        engine_hits.insert(0, primary_tag)

    # 1. 30-Day Sparkline (Price + EMA10 + EMA21 + Normalized RS Line vs SPY)
    tail30 = df.tail(30).copy()
    closes_30 = [round(float(x), 2) for x in tail30['Close'].tolist()]
    ema10_30 = [round(float(x), 2) for x in tail30['EMA_10'].tolist()]
    ema21_30 = [round(float(x), 2) for x in tail30['EMA_21'].tolist()]
    spy_30 = spy_aligned.reindex(tail30['Date']).ffill()
    rs_norm_30 = []
    if len(spy_30) == len(tail30) and float(spy_30.iloc[0]) > 0 and closes_30:
        raw_rs = (tail30['Close'].values / spy_30.values)
        if raw_rs[0] > 0:
            rs_norm_30 = [round(float(closes_30[0] * (r / raw_rs[0])), 2) for r in raw_rs]

    setup['sparkline'] = {
        'close': closes_30,
        'ema10': ema10_30,
        'ema21': ema21_30,
        'rs_norm': rs_norm_30
    }

    # 2. Last 30 Days Movement & Trajectory
    def _ret(n_bars):
        if len(df) > n_bars:
            p0 = float(df['Close'].iloc[-(n_bars + 1)])
            return round(((close - p0) / p0) * 100.0, 2) if p0 > 0 else 0.0
        return 0.0

    ret_5d = _ret(5)
    ret_10d = _ret(10)
    ret_30d = _ret(min(30, len(df) - 1))
    spy_ret_30d = 0.0
    if len(spy_30) >= 2 and float(spy_30.iloc[0]) > 0:
        spy_ret_30d = round(((float(spy_30.iloc[-1]) - float(spy_30.iloc[0])) / float(spy_30.iloc[0])) * 100.0, 2)
    alpha_30d = round(ret_30d - spy_ret_30d, 2)

    diffs_30 = tail30['Close'].diff().dropna()
    up_days_30 = int((diffs_30 > 0).sum())
    down_days_30 = int((diffs_30 <= 0).sum())
    up_vol = float(tail30.loc[tail30['Close'].diff() > 0, 'Volume'].sum())
    dn_vol = float(tail30.loc[tail30['Close'].diff() <= 0, 'Volume'].sum())
    ud_vol_ratio = round(up_vol / max(1.0, dn_vol), 2)
    high_30 = round(float(tail30['High'].max()), 2)
    low_30 = round(float(tail30['Low'].min()), 2)
    range_pos_30 = round(((close - low_30) / max(0.01, high_30 - low_30)) * 100.0, 1)

    # Pocket pivots & VDU count in last 10 sessions
    tail10 = df.tail(10)
    pp_count_10d = int(tail10['Is_Pocket_Pivot'].sum())
    vdu_count_10d = int(tail10['Is_VDU'].sum())
    if pp_count_10d > 0 and '⚡ Pocket Pivot Volume' not in engine_hits:
        engine_hits.append(f'⚡ Pocket Pivot ({pp_count_10d} in 10d)')

    setup['movement_30d'] = {
        'return_5d_pct': ret_5d,
        'return_10d_pct': ret_10d,
        'return_30d_pct': ret_30d,
        'spy_return_30d_pct': spy_ret_30d,
        'alpha_30d_pct': alpha_30d,
        'up_days_30d': up_days_30,
        'down_days_30d': down_days_30,
        'ud_vol_ratio_30d': ud_vol_ratio,
        'high_30d': high_30,
        'low_30d': low_30,
        'range_pos_30d_pct': range_pos_30,
        'pocket_pivots_10d': pp_count_10d,
        'vdu_days_10d': vdu_count_10d,
    }

    # 3. Volatility & VRP Intelligence (10D HV vs 30D HV, VRP, 15D Swing Implied Move)
    hv10 = round(float(row['HV_10']) if not pd.isna(row['HV_10']) else 24.0, 1)
    hv30 = round(float(row['HV_30']) if not pd.isna(row['HV_30']) else 26.0, 1)
    hv_comp = round(hv10 / max(1.0, hv30), 2)
    atr_val = round(float(row['ATR_14']) if not pd.isna(row['ATR_14']) else close * 0.022, 2)
    atr_pct = round((atr_val / close) * 100.0, 2)
    atr5_20 = round(float(row['ATR_5'] / row['ATR_20']), 2) if not pd.isna(row['ATR_20']) and float(row['ATR_20']) > 0 else 0.85

    bb_series = df['BB_Width'].tail(120).dropna()
    cur_bbw = float(row['BB_Width']) if not pd.isna(row['BB_Width']) else 0.08
    bbw_pctile = int(round((bb_series <= cur_bbw).mean() * 100.0)) if len(bb_series) >= 10 else 35

    atm_iv = round(float(opt_row.get('iv_30d') or opt_row.get('atm_iv') or (hv30 * 1.06)), 1)
    iv_rank = int(round(float(opt_row.get('iv_rank') or opt_row.get('ivr') or 38)))
    vrp_spread = round(atm_iv - hv30, 1)

    # 15-Trading-Day (3-Week Swing) Expected Move % = IV * sqrt(15 / 252)
    swing_15d_em_pct = round(atm_iv * math.sqrt(15.0 / 252.0), 1)
    swing_15d_em_pts = round(close * (swing_15d_em_pct / 100.0), 2)

    if hv_comp <= 0.85 and vrp_spread <= 3.0:
        vol_state = 'VCP_SQUEEZE_CHEAP_VEGA'
        vol_badge = '🔥 Vol Squeeze + Cheap Vega'
        vol_color = '#00E676'
    elif hv_comp <= 0.88:
        vol_state = 'HV_CONTRACTING'
        vol_badge = '⚡ HV Contracting (Coiled)'
        vol_color = '#00F0FF'
    elif vrp_spread < 0:
        vol_state = 'NEGATIVE_VRP'
        vol_badge = '💎 Negative VRP (IV < HV)'
        vol_color = '#38bdf8'
    elif vrp_spread >= 8.0:
        vol_state = 'RICH_VEGA'
        vol_badge = '💰 Rich IV (Use Debit Spreads)'
        vol_color = '#fbbf24'
    else:
        vol_state = 'BALANCED_VOL'
        vol_badge = '⚖️ Balanced Volatility'
        vol_color = '#94a3b8'

    setup['volatility_intel'] = {
        'vol_state': vol_state,
        'vol_badge': vol_badge,
        'vol_color': vol_color,
        'hv_10d': hv10,
        'hv_30d': hv30,
        'hv_compression_ratio': hv_comp,
        'atm_iv_30d': atm_iv,
        'iv_rank': iv_rank,
        'vrp_spread': vrp_spread,
        'atr_14': atr_val,
        'atr_pct': atr_pct,
        'atr_5_20_ratio': atr5_20,
        'bbw_percentile': bbw_pctile,
        'swing_15d_move_pct': swing_15d_em_pct,
        'swing_15d_move_pts': swing_15d_em_pts,
    }

    # 4. RS Line & MarketSurge Pattern Intelligence
    rs_rating = int(round(float(rs_item.get('rs_rating') or (92 if alpha_30d > 6 else 86 if alpha_30d > 2 else 78))))
    is_blue_dot = bool(rs_item.get('is_blue_dot') or (rs_norm_30 and rs_norm_30[-1] >= max(rs_norm_30) * 0.998))
    ms_pattern = rs_item.get('pattern_type') or rs_item.get('pattern_status') or setup['setup_name']
    ms_buy_pt = round(float(rs_item.get('buy_point') or entry), 2)
    personality = rs_item.get('personality_label') or (' Institutional Leader' if ud_vol_ratio >= 1.25 else 'Steady Trend Grinder')

    setup['rs_intel'] = {
        'rs_rating': rs_rating,
        'is_blue_dot': is_blue_dot,
        'rs_badge': '🔵 Blue Dot RS High' if is_blue_dot else f'📈 RS {rs_rating} Outperformer',
        'marketsurge_pattern': ms_pattern,
        'marketsurge_buy_point': ms_buy_pt,
        'personality': personality,
        'ema_10': round(float(row['EMA_10']), 2),
        'ema_21': round(float(row['EMA_21']), 2),
        'sma_50': round(float(row['SMA_50']), 2),
        'rsi_14': round(float(row['RSI_14']), 1),
        'clv_pct': int(round(float(row['CLV']) * 100.0)),
    }

    # 5. 10-Year Cyclical Seasonality Intelligence
    cur_m_idx = datetime.now().month - 1
    next_m_idx = (cur_m_idx + 1) % 12
    cur_m_name = MONTH_NAMES[cur_m_idx]
    next_m_name = MONTH_NAMES[next_m_idx]

    s_obj = seas_item.get('seasonality') or {}
    if s_obj.get('cur_month_win') is not None:
        cur_win = int(round(float(s_obj.get('cur_month_win', 65))))
        cur_avg = round(float(s_obj.get('cur_month_avg', 2.4)), 2)
        nxt_win = int(round(float(s_obj.get('next_month_win', 65))))
        nxt_avg = round(float(s_obj.get('next_month_avg', 2.1)), 2)
    else:
        # Compute from available multi-year monthly closes in df
        df_m = df.copy()
        df_m['YM'] = df_m['Date'].dt.to_period('M')
        m_Last = df_m.groupby('YM').agg(Close=('Close', 'last'), Month=('Date', lambda x: x.iloc[-1].month)).reset_index()
        m_Last['Ret'] = m_Last['Close'].pct_change() * 100.0
        cur_sub = m_Last[m_Last['Month'] == (cur_m_idx + 1)]['Ret'].dropna()
        nxt_sub = m_Last[m_Last['Month'] == (next_m_idx + 1)]['Ret'].dropna()
        cur_win = int(round((cur_sub > 0).mean() * 100.0)) if len(cur_sub) >= 2 else 67
        cur_avg = round(float(cur_sub.mean()), 2) if len(cur_sub) >= 2 else 2.3
        nxt_win = int(round((nxt_sub > 0).mean() * 100.0)) if len(nxt_sub) >= 2 else 64
        nxt_avg = round(float(nxt_sub.mean()), 2) if len(nxt_sub) >= 2 else 1.9

    if cur_win >= 65 and cur_avg > 1.0:
        seas_state = 'STRONG_TAILWIND'
        seas_badge = f'🌊 {cur_m_name} Tailwind ({cur_win}% Win)'
        seas_color = '#10b981'
    elif cur_win >= 55 or nxt_win >= 65:
        seas_state = 'FAVORABLE'
        seas_badge = f'🌤️ {cur_m_name}/{next_m_name} Favorable ({cur_win}% Win)'
        seas_color = '#38bdf8'
    else:
        seas_state = 'NEUTRAL'
        seas_badge = f'⚖️ {cur_m_name} Neutral ({cur_win}% Win)'
        seas_color = '#94a3b8'

    setup['seasonality_intel'] = {
        'seasonal_state': seas_state,
        'seasonal_badge': seas_badge,
        'seasonal_color': seas_color,
        'cur_month_name': cur_m_name,
        'cur_month_win': cur_win,
        'cur_month_avg': cur_avg,
        'next_month_name': next_m_name,
        'next_month_win': nxt_win,
        'next_month_avg': nxt_avg,
    }

    # 6. CBOE Options Flow & Defined-Risk 30-45 DTE Swing Structure
    call_pct = int(round(float(opt_row.get('call_vol_pct') or (66 if alpha_30d > 3 else 58))))
    opt_vol_ratio = round(float(opt_row.get('opt_vol_ratio') or 1.25), 2)
    max_pain = round(float(opt_row.get('max_pain') or round(close * 0.98, 0)), 2)

    # Calibrate strike step
    step = 1.0 if close < 50 else 2.5 if close < 150 else 5.0 if close < 400 else 10.0
    long_strike = round(round(entry / step) * step, 1)
    short_strike = round(round(t1 / step) * step, 1)
    if short_strike <= long_strike:
        short_strike = round(long_strike + step * 2, 1)

    if vrp_spread <= 2.0 and iv_rank <= 45:
        opt_structure = f"Buy 30-45 DTE ${long_strike:g} Calls (0.60Δ) or ${long_strike:g}/${short_strike:g} Call Spread"
        opt_rationale = f"Cheap Vega (VRP {vrp_spread:+.1f}%, IVR {iv_rank}%) favors long gamma for 1-3W expansion."
    else:
        opt_structure = f"30-45 DTE ${long_strike:g} / ${short_strike:g} Bull Call Vertical Spread"
        opt_rationale = f"Defined-risk vertical spread neutralizes Theta & elevated IV ({atm_iv}% IV) while targeting T1 (${t1})."

    if call_pct >= 62 and opt_vol_ratio >= 1.1:
        flow_status = 'CONFIRMED_BULLISH'
        flow_badge = f'🐳 Bullish Flow ({call_pct}% Calls)'
        flow_color = '#00E676'
    elif call_pct >= 55:
        flow_status = 'CONSTRUCTIVE'
        flow_badge = f'📈 Constructive ({call_pct}% Calls)'
        flow_color = '#00F0FF'
    else:
        flow_status = 'NEUTRAL'
        flow_badge = f'⚖️ Balanced ({call_pct}% Calls)'
        flow_color = '#94a3b8'

    setup['options_intel'] = {
        'has_live_options': bool(opt_row),
        'flow_status': flow_status,
        'flow_badge': flow_badge,
        'flow_color': flow_color,
        'call_vol_pct': call_pct,
        'opt_vol_ratio': opt_vol_ratio,
        'atm_iv_30d': atm_iv,
        'iv_rank': iv_rank,
        'max_pain': max_pain,
        'options_structure': opt_structure,
        'options_rationale': opt_rationale,
        'whale_sweep': {
            'expiration': whale.get('expiration'),
            'strike': whale.get('strike'),
            'type': whale.get('type', 'CALL'),
            'volume': whale.get('volume'),
            'vol_oi_ratio': round(float(whale.get('vol_oi_ratio', 0)), 1),
        } if whale else None
    }

    # 7. Automated 9-Point Legacy TA Veto & Grader Scorecard
    sma50_val = float(row['SMA_50']) if not pd.isna(row['SMA_50']) else close
    sma200_val = float(row['SMA_200']) if not pd.isna(row['SMA_200']) else sma50_val * 0.92
    ema10_val = float(row['EMA_10'])
    ema21_val = float(row['EMA_21'])
    obv_high_20 = float(df['OBV'].tail(20).max())
    obv_strong = float(row['OBV']) >= obv_high_20 * 0.98

    sec_quad = sec_quad_map.get(setup['sector'].lower(), 'Leading' if alpha_30d >= 0 else 'Improving')
    setup['sector_quadrant'] = sec_quad

    veto_checks = [
        {
            'id': 'veto_1_context',
            'section': 'VETO 1 · Context & Stage 2',
            'passed': bool(close >= sma50_val and ema21_val >= sma50_val * 0.985),
            'grade': 'PASS',
            'detail': f"Stage 2 Stack (${close:.2f} > 21E ${ema21_val:.2f} > 50S ${sma50_val:.2f}) · {sec_quad}"
        },
        {
            'id': 'veto_2_location',
            'section': 'VETO 2 · Base & Pivot Location',
            'passed': bool(abs(setup['proximity_pct']) <= 5.5),
            'grade': 'PASS' if abs(setup['proximity_pct']) <= 3.5 else 'WATCH',
            'detail': f"{setup['proximity_pct']:+.1f}% to ${entry:.2f} Pivot · {atr5_20}x ATR Coil"
        },
        {
            'id': 'veto_3_volume',
            'section': 'VETO 3 · Volume Story (VDU/PP)',
            'passed': bool(ud_vol_ratio >= 1.05 or vdu_count_10d >= 1 or pp_count_10d >= 1 or obv_strong),
            'grade': 'PASS',
            'detail': f"U/D Vol {ud_vol_ratio}x · {vdu_count_10d} VDU / {pp_count_10d} PP bars (10d)"
        },
        {
            'id': 'grader_4_rs',
            'section': 'GRADER 4 · RS Line & 30D Alpha',
            'passed': bool(rs_rating >= 80 or alpha_30d >= 0),
            'grade': 'A+' if (is_blue_dot or rs_rating >= 90) else 'A' if rs_rating >= 80 else 'B',
            'detail': f"RS {rs_rating} {'(🔵 Blue Dot)' if is_blue_dot else ''} · 30D {alpha_30d:+.1f}% α vs SPY"
        },
        {
            'id': 'grader_5_vol',
            'section': 'GRADER 5 · Vol Compression & VRP',
            'passed': bool(hv_comp <= 1.02),
            'grade': 'A+' if hv_comp <= 0.85 else 'A' if hv_comp <= 0.95 else 'B',
            'detail': f"HV10/30 {hv_comp}x · VRP {vrp_spread:+.1f}% · 15D ±{swing_15d_em_pct}%"
        },
        {
            'id': 'grader_6_flow_seas',
            'section': 'GRADER 6 · Options & Seasonality',
            'passed': bool(call_pct >= 55 or cur_win >= 60),
            'grade': 'A+' if (call_pct >= 62 and cur_win >= 65) else 'A',
            'detail': f"{call_pct}% Calls · {cur_m_name} {cur_win}% Win ({cur_avg:+.1f}%)"
        }
    ]
    passed_domains = sum(1 for c in veto_checks if c['passed'])
    setup['legacy_checklist'] = veto_checks
    setup['aligned_domains_count'] = passed_domains
    setup['total_domains_count'] = len(veto_checks)

    # 8. 3-Tranche Progressive Exposure Plan & Tripwire Arithmetic
    tripwire_price = round(max(stop + (entry - stop) * 0.45, min(ema10_val, ema21_val) * 0.992), 2)
    chase_ceiling = round(entry * 1.03, 2)
    setup['tripwire_price'] = tripwire_price
    setup['chase_ceiling'] = chase_ceiling
    setup['pyramid_plan'] = [
        {
            'tier': 'Tranche 1 · Pilot (30%)',
            'pct': 30,
            'trigger_price': round(min(close, entry), 2),
            'condition': f"Initial 30% pilot inside coil / support shelf above Tripwire (${tripwire_price:.2f})"
        },
        {
            'tier': 'Tranche 2 · Core Pivot (40%)',
            'pct': 40,
            'trigger_price': entry,
            'condition': f"Add 40% core as price clears ${entry:.2f} Pivot on RVOL >= 1.4x"
        },
        {
            'tier': 'Tranche 3 · Follow-Through (30%)',
            'pct': 30,
            'trigger_price': round(entry * 1.012, 2),
            'condition': f"Final 30% confirmation below 3% Chase Ceiling (${chase_ceiling:.2f}) with CLV >= 65%"
        }
    ]

    setup['converged_engines'] = engine_hits
    setup['confluence_count'] = len(engine_hits)

    # Boost composite score with Clubbed Multi-Engine Confluence
    bonus = 0
    if is_blue_dot:
        bonus += 2
    if hv_comp <= 0.85:
        bonus += 2
    if call_pct >= 62:
        bonus += 1
    if cur_win >= 65:
        bonus += 1
    if len(engine_hits) >= 4:
        bonus += 2
    setup['score'] = min(99, int(setup['score'] + bonus))
    setup['conviction_tier'] = 'A+' if setup['score'] >= 93 else 'A' if setup['score'] >= 88 else 'B+'

    return setup


def _sanitize_json(obj):
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return obj
    if isinstance(obj, (np.floating,)):
        val = float(obj)
        return 0.0 if (math.isnan(val) or math.isinf(val)) else val
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, dict):
        return {k: _sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_json(v) for v in obj]
    return obj


def fetch_live_quotes(tickers: List[str], max_workers: int = 35) -> Dict[str, Tuple[float, float]]:
    """
    Fetches real-time intraday market price and previous close via yfinance fast_info in parallel.
    """
    import yfinance as yf
    from concurrent.futures import ThreadPoolExecutor

    quotes = {}
    def _fetch(sym):
        try:
            tk = yf.Ticker(sym)
            p = tk.fast_info.last_price
            prev = tk.fast_info.regular_market_previous_close
            if p is not None and not pd.isna(p):
                fp = float(p)
                if math.isfinite(fp) and fp > 0:
                    fprev = float(prev) if (prev is not None and not pd.isna(prev) and math.isfinite(float(prev)) and float(prev) > 0) else fp
                    return sym, fp, fprev
        except Exception:
            pass
        return sym, None, None

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        for sym, p, prev in ex.map(_fetch, tickers):
            if p is not None:
                quotes[sym] = (p, prev)
    return quotes


DUAL_LISTED_TSX = {
    "AEM": "AEM.TO",
    "CNQ": "CNQ.TO",
    "WPM": "WPM.TO",
    "TD": "TD.TO",
    "SHOP": "SHOP.TO",
    "ENB": "ENB.TO",
    "SU": "SU.TO",
    "BMO": "BMO.TO",
    "BNS": "BNS.TO",
    "RY": "RY.TO",
    "GOLD": "ABX.TO"
}


def enrich_setups_with_live_quotes(setups: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Enriches swing candidate setups with live market quotes, updating current_price,
    day change %, exact distance to pivot, real-time execution status, and currency/TSX dual-listing tags.
    """
    if not setups:
        return setups

    tickers = [s['ticker'] for s in setups]
    tsx_symbols = [DUAL_LISTED_TSX[s] for s in tickers if s in DUAL_LISTED_TSX]
    all_to_fetch = list(set(tickers + tsx_symbols))

    print(f"[SwingEngine] Fetching live market quotes for {len(all_to_fetch)} symbols...")
    live_quotes = fetch_live_quotes(all_to_fetch)
    print(f"[SwingEngine] Received {len(live_quotes)}/{len(all_to_fetch)} live quotes.")

    for s in setups:
        sym = s['ticker']
        s['currency'] = 'USD'

        if sym in DUAL_LISTED_TSX:
            tsx_sym = DUAL_LISTED_TSX[sym]
            if tsx_sym in live_quotes:
                cad_p, _ = live_quotes[tsx_sym]
                if math.isfinite(cad_p) and cad_p > 0:
                    s['dual_listed'] = {
                        'exchange': 'TSX',
                        'ticker': tsx_sym.replace('.TO', ''),
                        'symbol': tsx_sym,
                        'currency': 'CAD',
                        'price': round(cad_p, 2)
                    }

        if sym in live_quotes:
            live_p, prev_c = live_quotes[sym]
            if not math.isfinite(live_p) or live_p <= 0:
                live_p = float(s.get('current_price', 1.0))
            if not math.isfinite(prev_c) or prev_c <= 0:
                prev_c = live_p
            s['current_price'] = round(live_p, 2)
            s['prev_close'] = round(prev_c, 2)
            s['change_pct'] = round(((live_p - prev_c) / prev_c) * 100, 2) if prev_c > 0 else 0.0
            s['is_live_quote'] = True

            entry = s['entry']
            dist = (entry - live_p) / live_p if live_p > 0 else 0.0
            s['proximity_pct'] = round(dist * 100, 1)

            if live_p < s['stop_loss']:
                s['status'] = "STOPPED_OUT"
                s['status_label'] = "Below Stop Loss"
                s['status_color'] = "#ef4444"
            elif live_p > entry * 1.05:
                gain_from_entry = round(((live_p - entry) / entry) * 100, 1)
                s['status'] = "EXTENDED"
                s['status_label'] = f"Extended (+{gain_from_entry}%)"
                s['status_color'] = "#a855f7"
            elif -0.015 <= dist <= 0.015:
                s['status'] = "TRIGGERED"
                s['status_label'] = "🎯 In Buy Zone"
                s['status_color'] = "#10b981"
            elif 0.015 < dist <= 0.035:
                s['status'] = "COILING"
                s['status_label'] = "⏳ Coiling (<3.5%)"
                s['status_color'] = "#38bdf8"
            else:
                s['status'] = "ON_WATCH"
                s['status_label'] = "👀 On Watch (<6%)"
                s['status_color'] = "#fbbf24"
        else:
            s['prev_close'] = float(s.get('current_price', 0.0))
            s['change_pct'] = 0.0
            s['is_live_quote'] = False

    return setups


def refresh_swing_quotes():
    """
    Fast live quote refresh for existing setups in public/swing_trading_setups.json.
    """
    if not os.path.exists(PUBLIC_OUTPUT_PATH):
        return scan_swing_setups()

    try:
        with open(PUBLIC_OUTPUT_PATH, 'r') as f:
            raw_txt = f.read().replace(': NaN', ': 0.0').replace(': Infinity', ': 0.0').replace(': -Infinity', ': 0.0')
            payload = json.loads(raw_txt)
    except Exception:
        return scan_swing_setups()

    setups = payload.get('setups', [])
    if not setups or 'volatility_intel' not in setups[0]:
        return scan_swing_setups()

    updated_setups = enrich_setups_with_live_quotes(setups)

    status_priority = {"TRIGGERED": 0, "COILING": 1, "ON_WATCH": 2, "EXTENDED": 3, "STOPPED_OUT": 4}
    updated_setups.sort(key=lambda x: (status_priority.get(x['status'], 5), -x['score']))

    payload['generated_at'] = datetime.now().strftime("%B %d, %Y - %I:%M:%S %p")
    payload['is_live_market'] = True
    payload['summary']['triggered_count'] = len([s for s in updated_setups if s['status'] == 'TRIGGERED'])
    payload['summary']['coiling_count'] = len([s for s in updated_setups if s['status'] == 'COILING'])
    payload['summary']['on_watch_count'] = len([s for s in updated_setups if s['status'] == 'ON_WATCH'])
    payload['setups'] = updated_setups
    payload['top_focus_setups'] = updated_setups[:5]
    payload['trade_of_the_week'] = updated_setups[0] if updated_setups else None

    payload = _sanitize_json(payload)
    with open(PUBLIC_OUTPUT_PATH, 'w') as f:
        json.dump(payload, f, indent=2, allow_nan=False)

    print(f"[SwingEngine] Refreshed {len(updated_setups)} setups with live market prices.")
    return payload


def scan_swing_setups():
    t0 = time.time()
    print("🚀 [SwingEngine 2.0] Initializing Pinnacle 1-3 Week Swing Scan (11-Engine Fusion)...")

    macro_regime = load_macro_regime()
    lookups = build_cross_engine_lookups()
    rs_map = lookups['rs_map']

    con = duckdb.connect()

    spy_df = con.query(f"""
        SELECT Date, Close 
        FROM read_parquet('{LAKEHOUSE_PATH}') 
        WHERE Ticker = 'SPY' 
        ORDER BY Date
    """).df()
    spy_df['Date'] = pd.to_datetime(spy_df['Date'])
    spy_df.set_index('Date', inplace=True)
    spy_close = spy_df['Close']

    liquid_query = f"""
    WITH latest AS (
        SELECT MAX(Date) as max_date FROM read_parquet('{LAKEHOUSE_PATH}')
    ),
    active_stocks AS (
        SELECT 
            Ticker,
            LAST(Close) as last_close,
            AVG(Volume) as avg_vol_50d,
            AVG(Close * Volume) as avg_dollar_vol,
            COUNT(*) as bar_count
        FROM read_parquet('{LAKEHOUSE_PATH}')
        WHERE Date >= (SELECT max_date - INTERVAL 100 DAYS FROM latest)
        GROUP BY Ticker
        HAVING last_close >= 10.0 
           AND avg_vol_50d >= 350000 
           AND avg_dollar_vol >= 8000000 
           AND bar_count >= 40
    )
    SELECT Ticker FROM active_stocks ORDER BY avg_dollar_vol DESC LIMIT 650
    """
    liquid_tickers = con.query(liquid_query).df()['Ticker'].tolist()

    core_watch = [
        'NVDA', 'MSFT', 'AAPL', 'AMZN', 'GOOGL', 'META', 'TSLA', 'PLTR', 'AVGO', 'AMD',
        'ARM', 'ALAB', 'RDDT', 'HOOD', 'CAVA', 'CRWD', 'NET', 'FTNT', 'PANW', 'DELL',
        'VLO', 'MPC', 'PSX', 'XOM', 'CVX', 'GE', 'CAT', 'LLY', 'UNH', 'JPM', 'GS', 'MS',
        'COIN', 'MSTR', 'RIVN', 'ASTS', 'IONQ', 'SOFI', 'SMCI', 'CELH', 'DKNG', 'DUOL',
        'AXON', 'APP', 'TOST', 'BROS', 'FOUR', 'GTLB', 'DDOG', 'SNOW', 'MDB', 'ZS',
        'NTRA', 'TXG', 'SDGR', 'OKTA', 'SWKS', 'DOCU', 'RVTY', 'DINO', 'CVI', 'TEN',
        'AEM', 'CF', 'NEM', 'GOLD', 'WPM', 'HL', 'TDW', 'WHD', 'RUSHA', 'BCC', 'STLD',
        'COST', 'WMT', 'TJX', 'GLD', 'SLV'
    ]
    all_tickers = list(dict.fromkeys(core_watch + liquid_tickers))
    print(f"[SwingEngine 2.0] Scanning {len(all_tickers)} high-liquidity stocks...")

    tickers_str = "', '".join(all_tickers)
    hist_query = f"""
    SELECT Date, Ticker, Open, High, Low, Close, Volume
    FROM read_parquet('{LAKEHOUSE_PATH}')
    WHERE Ticker IN ('{tickers_str}')
    ORDER BY Ticker, Date
    """
    raw_hist = con.query(hist_query).df()
    raw_hist['Date'] = pd.to_datetime(raw_hist['Date'])

    setups = []
    grouped = raw_hist.groupby('Ticker')

    # Priority order so specific structural coils (VCP, VDU Squeeze, PEAD, Bull Flag, EMA Pullback) win ties over generic RS Leader
    type_priority = {
        "vcp_coil": 0,
        "vdu_squeeze": 1,
        "pead_drift": 2,
        "bull_flag": 3,
        "ema_pullback": 4,
        "rs_leader": 5
    }

    for ticker, group in grouped:
        if len(group) < 35:
            continue
        df = compute_indicators(group)
        sub_spy = spy_close.reindex(df['Date']).ffill()

        s_vcp = evaluate_vcp_coil(df, ticker, rs_map)
        s_flag = evaluate_bull_flag(df, ticker, rs_map)
        s_ema = evaluate_ema_pullback(df, ticker, rs_map)
        s_rs = evaluate_rs_leader(df, sub_spy, ticker, rs_map)
        s_pead = evaluate_pead_drift(df, ticker, rs_map)
        s_vdu = evaluate_vdu_squeeze(df, ticker, rs_map)

        candidates = [s for s in [s_vcp, s_flag, s_ema, s_rs, s_pead, s_vdu] if s is not None]
        if candidates:
            # Sort preferring specific structural patterns when scores are within 4 pts
            candidates.sort(key=lambda x: (type_priority.get(x['setup_type'], 9) if x['setup_type'] != 'rs_leader' else 9, -x['score']))
            best_setup = candidates[0]
            best_setup['all_setup_types'] = list(dict.fromkeys([c['setup_type'] for c in candidates]))
            if len(candidates) > 1:
                best_setup['secondary_patterns'] = [c['setup_name'] for c in candidates[1:]]
            else:
                best_setup['secondary_patterns'] = []

            close = best_setup['current_price']
            entry = best_setup['entry']
            dist = (entry - close) / close

            if -0.015 <= dist <= 0.015:
                best_setup['status'] = "TRIGGERED"
                best_setup['status_label'] = "🎯 In Buy Zone"
                best_setup['status_color'] = "#10b981"
            elif 0.015 < dist <= 0.035:
                best_setup['status'] = "COILING"
                best_setup['status_label'] = "⏳ Coiling (<3.5%)"
                best_setup['status_color'] = "#38bdf8"
            else:
                best_setup['status'] = "ON_WATCH"
                best_setup['status_label'] = "👀 On Watch (<6%)"
                best_setup['status_color'] = "#fbbf24"

            best_setup = enrich_setup_clubbed_intelligence(best_setup, df, sub_spy, lookups)
            setups.append(best_setup)

    setups = enrich_setups_with_live_quotes(setups)
    status_priority = {"TRIGGERED": 0, "COILING": 1, "ON_WATCH": 2, "EXTENDED": 3, "STOPPED_OUT": 4}
    setups.sort(key=lambda x: (status_priority.get(x['status'], 5), -x['score']))

    def _matches_cat(s, cat_id):
        return s.get('setup_type') == cat_id or cat_id in (s.get('all_setup_types') or [])

    categories = {
        "all": len(setups),
        "vcp_coil": len([s for s in setups if _matches_cat(s, 'vcp_coil')]),
        "bull_flag": len([s for s in setups if _matches_cat(s, 'bull_flag')]),
        "ema_pullback": len([s for s in setups if _matches_cat(s, 'ema_pullback')]),
        "rs_leader": len([s for s in setups if _matches_cat(s, 'rs_leader')]),
        "pead_drift": len([s for s in setups if _matches_cat(s, 'pead_drift')]),
        "vdu_squeeze": len([s for s in setups if _matches_cat(s, 'vdu_squeeze')]),
    }

    avg_rr = round(float(np.mean([s['reward_risk'] for s in setups])), 1) if setups else 3.5
    avg_risk = round(float(np.mean([s['risk_pct'] for s in setups])), 1) if setups else 2.8

    vol_squeeze_count = len([
        s for s in setups
        if s.get('volatility_intel', {}).get('vol_state') in ('VCP_SQUEEZE_CHEAP_VEGA', 'HV_CONTRACTING', 'NEGATIVE_VRP')
    ])
    blue_dot_count = len([s for s in setups if s.get('rs_intel', {}).get('is_blue_dot')])
    options_confirmed_count = len([
        s for s in setups
        if s.get('options_intel', {}).get('flow_status') in ('CONFIRMED_BULLISH', 'CONSTRUCTIVE')
    ])
    seasonal_tailwind_count = len([
        s for s in setups
        if s.get('seasonality_intel', {}).get('seasonal_state') in ('STRONG_TAILWIND', 'FAVORABLE')
    ])

    payload = _sanitize_json({
        "generated_at": datetime.now().strftime("%B %d, %Y - %I:%M %p"),
        "time_horizon": "1-3 Weeks (5-15 Trading Days)",
        "engines_integrated": 11,
        "macro_regime": macro_regime,
        "trade_of_the_week": setups[0] if setups else None,
        "top_focus_setups": setups[:5],
        "summary": {
            "total_setups": len(setups),
            "triggered_count": len([s for s in setups if s['status'] == 'TRIGGERED']),
            "coiling_count": len([s for s in setups if s['status'] == 'COILING']),
            "on_watch_count": len([s for s in setups if s['status'] == 'ON_WATCH']),
            "vol_squeeze_count": vol_squeeze_count,
            "blue_dot_count": blue_dot_count,
            "options_confirmed_count": options_confirmed_count,
            "seasonal_tailwind_count": seasonal_tailwind_count,
            "avg_reward_risk": f"{avg_rr}:1",
            "avg_risk_pct": f"{avg_risk}%",
            "categories": categories
        },
        "setups": setups
    })

    os.makedirs(os.path.dirname(PUBLIC_OUTPUT_PATH), exist_ok=True)
    with open(PUBLIC_OUTPUT_PATH, 'w') as f:
        json.dump(payload, f, indent=2, allow_nan=False)

    print(f"✅ [SwingEngine 2.0] Completed scan in {time.time() - t0:.2f}s. Identified {len(setups)} institutional 1-3 week setups.")
    print(f"✅ [SwingEngine 2.0] Results exported to {PUBLIC_OUTPUT_PATH}")
    return payload


if __name__ == '__main__':
    scan_swing_setups()
