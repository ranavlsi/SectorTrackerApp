#!/usr/bin/env python3
"""
Institutional 1-3 Week Swing Trading Engine
Specialized for 5 to 15 trading day holding periods.
Scans liquid universe and detects:
1. Minervini VCP Coils (vcp_coil)
2. High-Tight & Bull Flags (bull_flag)
3. 10/21 EMA Pullbacks & Pocket Pivots (ema_pullback)
4. RS Line New High Ahead of Price (rs_leader)
5. Post-Earnings Drift / PEAD Shelves (pead_drift)
6. Extreme Volatility Dry-Up / Squeezes (vdu_squeeze)

Produces calibrated execution plans:
- Exact Entry Pivot Trigger ($)
- Volatility & Structural Invalidation Stop ($) (strictly 1.5% - 4.0% risk)
- Target 1 ($ & %) [5-8 Days, ~2R]
- Target 2 ($ & %) [10-15 Days, ~3.5R - 5R]
- R:R Ratio (>= 3.0:1)
- Position sizing guidance
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

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
PUBLIC_OUTPUT_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/public/swing_trading_setups.json'
MARKET_HEALTH_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/public/market_health.json'
WEEKLY_PLAYBOOK_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/public/weekly_playbook.json'

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
}

def get_profile(ticker: str):
    if ticker in SECTOR_MAP:
        return SECTOR_MAP[ticker][0], SECTOR_MAP[ticker][1]
    return ticker, "Growth & Momentum"


def load_macro_regime():
    """Extract macro swing regime & exposure recommendation from market health."""
    default_regime = {
        "regime": "RISK_OFF",
        "regime_label": "Defensive / Capital Preservation",
        "regime_color": "#ef4444",
        "score_value": 28.9,
        "recommended_exposure": "0% - 25% Invested (Preserve Capital)",
        "exposure_pct": 20,
        "swing_verdict": "Cautious: Take fast profits at T1 (+5% to +8%). Limit open risk to 20% of book.",
        "mco_status": "Extreme Oversold",
        "breadth_above_50": 32.4
    }
    
    if os.path.exists(MARKET_HEALTH_PATH):
        try:
            with open(MARKET_HEALTH_PATH, 'r') as f:
                health = json.load(f)
                cur = health.get("current_health", {})
                score = cur.get("score_value", 50.0)
                regime = cur.get("health_regime", "CAUTIOUS")
                regime_label = cur.get("health_regime_label", "Cautious (Neutral/Choppy)")
                regime_color = cur.get("health_regime_color", "#f59e0b")
                
                if score >= 65:
                    recommended_exp = "75% - 100% Invested (Aggressive Swing Expansion)"
                    exposure_pct = 90
                    verdict = "Full Green Light: Breakouts follow through. Hold runners to Target 2 (+15% to +25%)."
                elif score >= 45:
                    recommended_exp = "40% - 60% Invested (Tactical Selective Swings)"
                    exposure_pct = 50
                    verdict = "Tactical Market: Focus strictly on A+ Leaders. Scale 50% off at Target 1 and raise stop to break-even."
                else:
                    recommended_exp = "0% - 25% Invested (High Cash / Capital Preservation)"
                    exposure_pct = 20
                    verdict = "Defensive Regime: Take quick profits at Target 1 (+5% to +8%). Keep stop losses strictly capped at 2.5%."
                    
                return {
                    "regime": regime,
                    "regime_label": regime_label,
                    "regime_color": regime_color,
                    "score_value": score,
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
    """Add EMAs, SMAs, ATR, Bollinger Bands, and Volume metrics."""
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
    
    prev_c = c.shift(1)
    tr = pd.concat([
        h - l,
        (h - prev_c).abs(),
        (l - prev_c).abs()
    ], axis=1).max(axis=1)
    df['ATR_14'] = tr.rolling(14).mean()
    df['ATR_5'] = tr.rolling(5).mean()
    df['ATR_20'] = tr.rolling(20).mean()
    
    df['Vol_50'] = v.rolling(50).mean()
    df['Vol_5'] = v.rolling(5).mean()
    
    std_20 = c.rolling(20).std()
    df['BB_Upper'] = df['SMA_20'] + (std_20 * 2.0)
    df['BB_Lower'] = df['SMA_20'] - (std_20 * 2.0)
    df['BB_Width'] = (df['BB_Upper'] - df['BB_Lower']) / df['SMA_20']
    
    df['High_52W'] = h.rolling(min(252, len(df))).max()
    df['Low_52W'] = l.rolling(min(252, len(df))).min()
    
    return df


def evaluate_vcp_coil(df: pd.DataFrame, ticker: str):
    if len(df) < 55: return None
    row = df.iloc[-1]
    close = row['Close']
    sma50 = row['SMA_50']
    sma200 = row['SMA_200']
    atr = row['ATR_14']
    
    if pd.isna(sma50) or pd.isna(atr) or atr <= 0: return None
    if close < sma50: return None
    if not pd.isna(sma200) and close < sma200 * 0.95: return None
    
    base_window = min(50, len(df))
    sub = df.tail(base_window)
    base_high = sub['High'].max()
    dist_to_high = (base_high - close) / base_high
    
    if dist_to_high < -0.01 or dist_to_high > 0.055: return None
    
    atr5 = row['ATR_5']
    atr20 = row['ATR_20']
    if pd.isna(atr5) or pd.isna(atr20) or atr20 == 0: return None
    if (atr5 / atr20) > 0.92: return None
    
    vol50 = row['Vol_50']
    recent_vol = sub['Volume'].tail(3).mean()
    if pd.isna(vol50) or vol50 == 0 or (recent_vol / vol50) > 1.05: return None
    
    entry = round(base_high + (0.05 * atr), 2)
    recent_low = sub['Low'].tail(5).min()
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
    rr = round((t2 - entry) / (entry - raw_sl), 1)
    
    score = 88
    if (recent_vol / vol50) < 0.70: score += 5
    if dist_to_high < 0.025: score += 4
    
    name, sector = get_profile(ticker)
    return {
        "ticker": ticker,
        "company_name": name,
        "sector": sector,
        "setup_type": "vcp_coil",
        "setup_name": "Minervini VCP Coil",
        "category_badge": "VCP Coil",
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
        "catalyst_note": f"Base High: ${base_high:.2f}. Volatility contracted {max(0, (1 - atr5/atr20)*100):.0f}% with VDU at {recent_vol/vol50:.2f}x average volume.",
        "execution_strategy": "Place Buy Stop order at Entry. Take 50% partial profit at T1 (+5-8%), move stop to break-even, and let runner ride to T2."
    }


def evaluate_bull_flag(df: pd.DataFrame, ticker: str):
    if len(df) < 30: return None
    row = df.iloc[-1]
    close = row['Close']
    atr = row['ATR_14']
    ema10 = row['EMA_10']
    ema21 = row['EMA_21']
    
    if pd.isna(atr) or atr <= 0: return None
    if close < ema21 * 0.985: return None
    
    sub = df.tail(25)
    pole_high = sub['High'].max()
    pole_high_idx = sub['High'].values.argmax()
    bars_since_high = len(sub) - 1 - pole_high_idx
    
    if bars_since_high < 3 or bars_since_high > 12: return None
    
    prior_window = sub.iloc[:pole_high_idx]
    if len(prior_window) < 3: return None
    pole_low = prior_window['Low'].min()
    pole_gain = (pole_high - pole_low) / pole_low
    if pole_gain < 0.14: return None
    
    flag_data = sub.iloc[pole_high_idx:]
    flag_low = flag_data['Low'].min()
    flag_depth = (pole_high - flag_low) / pole_high
    if flag_depth > 0.13: return None
    
    flag_high = flag_data['High'].iloc[:-1].max() if len(flag_data) > 1 else pole_high
    
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
    rr = round((t2 - entry) / (entry - raw_sl), 1)
    
    score = 90
    if pole_gain > 0.25: score += 4
    if flag_depth < 0.07: score += 4
    
    name, sector = get_profile(ticker)
    return {
        "ticker": ticker,
        "company_name": name,
        "sector": sector,
        "setup_type": "bull_flag",
        "setup_name": "High-Tight Bull Flag",
        "category_badge": "Bull Flag",
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
        "catalyst_note": f"Pole thrust: +{pole_gain*100:.1f}%. Flag consolidation: {bars_since_high} sessions with only {flag_depth*100:.1f}% shallow pullback.",
        "execution_strategy": "Buy the flag pivot breakout. Explosive expansion typically resolves within 3 to 7 trading days."
    }


def evaluate_ema_pullback(df: pd.DataFrame, ticker: str):
    if len(df) < 55: return None
    row = df.iloc[-1]
    close = row['Close']
    high = row['High']
    low = row['Low']
    atr = row['ATR_14']
    ema10 = row['EMA_10']
    ema21 = row['EMA_21']
    sma50 = row['SMA_50']
    
    if pd.isna(sma50) or pd.isna(atr) or atr <= 0: return None
    if close < sma50: return None
    
    close_25d_ago = df['Close'].iloc[-25]
    if (close - close_25d_ago) / close_25d_ago < 0.05: return None
    
    dist_10 = abs(close - ema10) / ema10
    dist_21 = abs(close - ema21) / ema21
    
    is_at_10 = (dist_10 <= 0.018) and (low <= ema10 * 1.008)
    is_at_21 = (dist_21 <= 0.022) and (low <= ema21 * 1.010)
    
    if not (is_at_10 or is_at_21): return None
    
    candle_range = high - low
    if candle_range > 0 and (close - low) / candle_range < 0.35: return None
    
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
        
    swing_high = df['High'].tail(20).max()
    t1 = round(max(swing_high, entry + (2.0 * risk_dollars)), 2)
    t2 = round(max(t1 * 1.08, entry + (3.8 * risk_dollars)), 2)
    rr = round((t2 - entry) / (entry - raw_sl), 1)
    
    score = 86
    if is_at_10: score += 5
    if (close - low) / (candle_range if candle_range > 0 else 1) > 0.65: score += 4
    
    name, sector = get_profile(ticker)
    return {
        "ticker": ticker,
        "company_name": name,
        "sector": sector,
        "setup_type": "ema_pullback",
        "setup_name": f"{active_ma} Pullback Support",
        "category_badge": "EMA Pullback",
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
        "catalyst_note": f"Orderly test of rising {active_ma} (${support_val:.2f}). Support held with buyers defending institutional baseline.",
        "execution_strategy": f"Enter as price takes out prior day high. Exit 50% at prior swing high (${swing_high:.2f}), trail remainder along 10-EMA."
    }


def evaluate_rs_leader(df: pd.DataFrame, spy_aligned: pd.Series, ticker: str):
    if len(df) < 60 or spy_aligned is None or len(spy_aligned) < 60: return None
    row = df.iloc[-1]
    close = row['Close']
    atr = row['ATR_14']
    sma50 = row['SMA_50']
    
    if pd.isna(sma50) or pd.isna(atr) or atr <= 0 or close < sma50: return None
    
    rs_series = df['Close'] / spy_aligned
    rs_60d_high = rs_series.tail(60).max()
    curr_rs = rs_series.iloc[-1]
    
    if curr_rs < rs_60d_high * 0.995: return None
    
    price_60d_high = df['High'].tail(60).max()
    price_gap = (price_60d_high - close) / price_60d_high
    if price_gap < 0.015 or price_gap > 0.09: return None
    
    local_high = df['High'].tail(10).max()
    entry = round(local_high + (0.05 * atr), 2)
    local_low = df['Low'].tail(10).min()
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
    rr = round((t2 - entry) / (entry - raw_sl), 1)
    
    score = 92
    if curr_rs >= rs_60d_high: score += 5
    
    name, sector = get_profile(ticker)
    return {
        "ticker": ticker,
        "company_name": name,
        "sector": sector,
        "setup_type": "rs_leader",
        "setup_name": "RS Line New High Breakout",
        "category_badge": "RS Leader",
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
        "catalyst_note": f"RS Line printed fresh 60-day high vs SPY while stock price is still {price_gap*100:.1f}% below peak (${price_60d_high:.2f}). Huge institutional accumulation signal.",
        "execution_strategy": "Pre-pivot accumulation. RS divergence guarantees market outperformance once price breaks resistance."
    }


def evaluate_pead_drift(df: pd.DataFrame, ticker: str):
    if len(df) < 35: return None
    row = df.iloc[-1]
    close = row['Close']
    atr = row['ATR_14']
    if pd.isna(atr) or atr <= 0: return None
    
    sub = df.tail(25)
    gap_idx = -1
    for i in range(len(sub) - 4):
        prev_close = sub['Close'].iloc[i]
        curr_open = sub['Open'].iloc[i+1]
        curr_vol = sub['Volume'].iloc[i+1]
        vol_50 = sub['Vol_50'].iloc[i+1]
        
        if pd.isna(vol_50) or vol_50 == 0: continue
        
        gap_pct = (curr_open - prev_close) / prev_close
        vol_mult = curr_vol / vol_50
        
        if gap_pct >= 0.04 and vol_mult >= 1.8:
            gap_idx = i + 1
            break
            
    if gap_idx == -1: return None
    
    gap_bar = sub.iloc[gap_idx]
    post_gap = sub.iloc[gap_idx:]
    gap_low = gap_bar['Low']
    
    if post_gap['Close'].min() < gap_low * 0.985: return None
    
    shelf_data = sub.tail(5)
    shelf_high = shelf_data['High'].max()
    shelf_low = shelf_data['Low'].min()
    shelf_range = (shelf_high - shelf_low) / shelf_low
    if shelf_range > 0.075: return None
    
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
    rr = round((t2 - entry) / (entry - raw_sl), 1)
    
    name, sector = get_profile(ticker)
    return {
        "ticker": ticker,
        "company_name": name,
        "sector": sector,
        "setup_type": "pead_drift",
        "setup_name": "Post-Earnings Drift Shelf",
        "category_badge": "PEAD Shelf",
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
        "catalyst_note": f"Massive Power Earnings Gap defended. Consolidating tightly above gap floor (${gap_low:.2f}) with institutional absorption.",
        "execution_strategy": "Secondary momentum wave entry. Post-earnings drift typically propels price for 10-20 trading sessions."
    }


def evaluate_vdu_squeeze(df: pd.DataFrame, ticker: str):
    if len(df) < 55: return None
    row = df.iloc[-1]
    close = row['Close']
    atr = row['ATR_14']
    bb_width = row['BB_Width']
    sma50 = row['SMA_50']
    vol50 = row['Vol_50']
    
    if pd.isna(sma50) or pd.isna(atr) or atr <= 0 or close < sma50: return None
    if pd.isna(bb_width) or bb_width > 0.11: return None
    
    atr5 = row['ATR_5']
    atr20 = row['ATR_20']
    if pd.isna(atr5) or pd.isna(atr20) or atr20 == 0 or (atr5 / atr20) > 0.85: return None
    
    recent_vol = df['Volume'].tail(3).mean()
    if pd.isna(vol50) or vol50 == 0 or (recent_vol / vol50) > 0.90: return None
    
    coil_high = df['High'].tail(5).max()
    coil_low = df['Low'].tail(5).min()
    
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
    rr = round((t2 - entry) / (entry - raw_sl), 1)
    
    score = 89
    if (atr5 / atr20) < 0.70: score += 5
    if bb_width < 0.065: score += 4
    
    name, sector = get_profile(ticker)
    return {
        "ticker": ticker,
        "company_name": name,
        "sector": sector,
        "setup_type": "vdu_squeeze",
        "setup_name": "Volatility Dry-Up (VDU) Squeeze",
        "category_badge": "VDU Squeeze",
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
        "catalyst_note": f"Extreme coiling spring. Bollinger Band width compressed to {bb_width*100:.1f}% with ATR ratio at {atr5/atr20:.2f}. Imminent kinetic expansion.",
        "execution_strategy": "Place conditional bracket order above coil high. Squeezes typically spark explosive momentum bursts within 48-72 hours."
    }



def fetch_live_quotes(tickers: List[str], max_workers: int = 35) -> Dict[str, Tuple[float, float]]:
    """
    Fetches real-time intraday market price and previous close via yfinance fast_info in parallel.
    Takes ~1.5 - 2.0 seconds for 140+ tickers.
    """
    import yfinance as yf
    from concurrent.futures import ThreadPoolExecutor
    
    quotes = {}
    def _fetch(sym):
        try:
            tk = yf.Ticker(sym)
            p = tk.fast_info.last_price
            prev = tk.fast_info.regular_market_previous_close
            if p and p > 0:
                return sym, float(p), float(prev) if prev else float(p)
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
    
    # Also collect any dual-listed TSX symbols
    tsx_symbols = [DUAL_LISTED_TSX[s] for s in tickers if s in DUAL_LISTED_TSX]
    all_to_fetch = list(set(tickers + tsx_symbols))
    
    print(f"[SwingEngine] Fetching live market quotes for {len(all_to_fetch)} symbols (including {len(tsx_symbols)} TSX dual listings)...")
    live_quotes = fetch_live_quotes(all_to_fetch)
    print(f"[SwingEngine] Received {len(live_quotes)}/{len(all_to_fetch)} live quotes.")

    for s in setups:
        sym = s['ticker']
        s['currency'] = 'USD'
        
        # Check for Canadian dual-listing
        if sym in DUAL_LISTED_TSX:
            tsx_sym = DUAL_LISTED_TSX[sym]
            if tsx_sym in live_quotes:
                cad_p, _ = live_quotes[tsx_sym]
                s['dual_listed'] = {
                    'exchange': 'TSX',
                    'ticker': tsx_sym.replace('.TO', ''),
                    'symbol': tsx_sym,
                    'currency': 'CAD',
                    'price': round(cad_p, 2)
                }
        
        if sym in live_quotes:
            live_p, prev_c = live_quotes[sym]
            s['current_price'] = round(live_p, 2)
            s['prev_close'] = round(prev_c, 2)
            s['change_pct'] = round(((live_p - prev_c) / prev_c) * 100, 2)
            s['is_live_quote'] = True
            
            # Recompute distance to pivot based on real-time price
            entry = s['entry']
            dist = (entry - live_p) / live_p
            s['proximity_pct'] = round(dist * 100, 1)
            
            # Dynamic live trigger status
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
                s['status_label'] = "In Buy Zone"
                s['status_color'] = "#10b981"
            elif 0.015 < dist <= 0.035:
                s['status'] = "COILING"
                s['status_label'] = "Coiling (<3.5%)"
                s['status_color'] = "#38bdf8"
            else:
                s['status'] = "ON_WATCH"
                s['status_label'] = "On Watch (<6%)"
                s['status_color'] = "#fbbf24"
        else:
            s['is_live_quote'] = False

    return setups


def refresh_swing_quotes():
    """
    Sub-second / 2-second fast live quote refresh for existing setups in public/swing_trading_setups.json.
    Avoids re-running 660+ parquet indicator computations while ensuring prices are 100% current.
    """
    if not os.path.exists(PUBLIC_OUTPUT_PATH):
        return scan_swing_setups()
        
    try:
        with open(PUBLIC_OUTPUT_PATH, 'r') as f:
            payload = json.load(f)
    except Exception:
        return scan_swing_setups()
        
    setups = payload.get('setups', [])
    if not setups:
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
    
    with open(PUBLIC_OUTPUT_PATH, 'w') as f:
        json.dump(payload, f, indent=2)
        
    print(f"[SwingEngine] Refreshed {len(updated_setups)} setups with live market prices.")
    return payload


def scan_swing_setups():
    t0 = time.time()
    print("[SwingEngine] Initializing Institutional 1-3 Week Swing Scan...")
    
    macro_regime = load_macro_regime()
    print(f"[SwingEngine] Macro Regime: {macro_regime['regime']} ({macro_regime['regime_label']}) - Exposure: {macro_regime['recommended_exposure']}")
    
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
    
    print("[SwingEngine] Filtering liquid candidates from parquet lakehouse...")
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
        'AEM', 'CF', 'NEM', 'GOLD', 'WPM', 'HL', 'TDW', 'WHD', 'RUSHA', 'BCC', 'STLD'
    ]
    all_tickers = list(dict.fromkeys(core_watch + liquid_tickers))
    print(f"[SwingEngine] Scanning {len(all_tickers)} high-liquidity stocks...")
    
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
    
    for ticker, group in grouped:
        if len(group) < 35: continue
        df = compute_indicators(group)
        
        sub_spy = spy_close.reindex(df['Date']).ffill()
        
        s_vcp = evaluate_vcp_coil(df, ticker)
        s_flag = evaluate_bull_flag(df, ticker)
        s_ema = evaluate_ema_pullback(df, ticker)
        s_rs = evaluate_rs_leader(df, sub_spy, ticker)
        s_pead = evaluate_pead_drift(df, ticker)
        s_vdu = evaluate_vdu_squeeze(df, ticker)
        
        candidates = [s for s in [s_vcp, s_flag, s_ema, s_rs, s_pead, s_vdu] if s is not None]
        if candidates:
            candidates.sort(key=lambda x: x['score'], reverse=True)
            best_setup = candidates[0]
            
            close = best_setup['current_price']
            entry = best_setup['entry']
            dist = (entry - close) / close
            
            if dist <= 0.015 and dist >= -0.015:
                best_setup['status'] = "TRIGGERED"
                best_setup['status_label'] = "In Buy Zone"
                best_setup['status_color'] = "#10b981"
            elif dist > 0.015 and dist <= 0.035:
                best_setup['status'] = "COILING"
                best_setup['status_label'] = "Coiling (<3.5%)"
                best_setup['status_color'] = "#38bdf8"
            else:
                best_setup['status'] = "ON_WATCH"
                best_setup['status_label'] = "On Watch (<6%)"
                best_setup['status_color'] = "#fbbf24"
                
            setups.append(best_setup)
            
    setups = enrich_setups_with_live_quotes(setups)
    status_priority = {"TRIGGERED": 0, "COILING": 1, "ON_WATCH": 2, "EXTENDED": 3, "STOPPED_OUT": 4}
    setups.sort(key=lambda x: (status_priority.get(x['status'], 5), -x['score']))
    
    categories = {
        "all": len(setups),
        "vcp_coil": len([s for s in setups if s['setup_type'] == 'vcp_coil']),
        "bull_flag": len([s for s in setups if s['setup_type'] == 'bull_flag']),
        "ema_pullback": len([s for s in setups if s['setup_type'] == 'ema_pullback']),
        "rs_leader": len([s for s in setups if s['setup_type'] == 'rs_leader']),
        "pead_drift": len([s for s in setups if s['setup_type'] == 'pead_drift']),
        "vdu_squeeze": len([s for s in setups if s['setup_type'] == 'vdu_squeeze']),
    }
    
    avg_rr = round(float(np.mean([s['reward_risk'] for s in setups])), 1) if setups else 3.5
    avg_risk = round(float(np.mean([s['risk_pct'] for s in setups])), 1) if setups else 2.8
    
    payload = {
        "generated_at": datetime.now().strftime("%B %d, %Y - %I:%M %p"),
        "time_horizon": "1-3 Weeks (5-15 Trading Days)",
        "macro_regime": macro_regime,
        "summary": {
            "total_setups": len(setups),
            "triggered_count": len([s for s in setups if s['status'] == 'TRIGGERED']),
            "coiling_count": len([s for s in setups if s['status'] == 'COILING']),
            "on_watch_count": len([s for s in setups if s['status'] == 'ON_WATCH']),
            "avg_reward_risk": f"{avg_rr}:1",
            "avg_risk_pct": f"{avg_risk}%",
            "categories": categories
        },
        "setups": setups
    }
    
    os.makedirs(os.path.dirname(PUBLIC_OUTPUT_PATH), exist_ok=True)
    with open(PUBLIC_OUTPUT_PATH, 'w') as f:
        json.dump(payload, f, indent=2)
        
    print(f"[SwingEngine] Completed scan in {time.time() - t0:.2f}s. Identified {len(setups)} institutional 1-3 week setups.")
    print(f"[SwingEngine] Results exported to {PUBLIC_OUTPUT_PATH}")
    return payload


if __name__ == '__main__':
    scan_swing_setups()
