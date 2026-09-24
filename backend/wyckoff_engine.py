#!/usr/bin/env python3
"""
Wyckoff Method Screener & Interactive Analysis Engine
=====================================================
Analyzes institutional accumulation & distribution footprints using Richard Wyckoff's 
Three Fundamental Laws:
  1. Law of Supply and Demand (Volume Spread Analysis & CLV)
  2. Law of Cause and Effect (Dynamic Base Duration & Point & Figure Projection)
  3. Law of Effort vs. Result (Volume Spread Analysis - VSA)

Detects structural Wyckoff phases and actionable setups:
  - Phase C: Springs (Type 1, 2, 3) & Shakeouts
  - Phase D: Sign of Strength (SOS) & Jump Across The Creek (JAC)
  - Phase D: Last Point of Support (LPS) / Back-Up (BU)
  - Phase B->C: Supply Absorption at Resistance
  - Phase C/D (Distribution): Upthrust After Distribution (UTAD) & Sign of Weakness (SOW)
"""

import os
import sys
import json
import time
import datetime
import math
import numpy as np
import pandas as pd
import duckdb

# Optional fallback
try:
    import yfinance as yf
except ImportError:
    yf = None

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(CURRENT_DIR)
LAKEHOUSE_PATH = os.path.join(CURRENT_DIR, 'data', 'daily_ohlcv.parquet')
DATA_DIR = os.path.join(CURRENT_DIR, 'data')
CACHE_FILE = os.path.join(DATA_DIR, 'wyckoff_screener.json')

# Liquid tickers for the universe scan
CORE_UNIVERSE = [
    "NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "AMD", "AVGO", "SMCI",
    "ARM", "PLTR", "COIN", "MSTR", "NFLX", "UBER", "CRWD", "PANW", "SNOW", "DDOG",
    "APP", "NOW", "SHOP", "NET", "PATH", "ORCL", "CRM", "INTC", "QCOM", "MU",
    "AMAT", "LRCX", "KLAC", "MRVL", "TSM", "ASML", "GFS", "ON", "MPWR", "TXN",
    "JPM", "GS", "MS", "BAC", "WFC", "V", "MA", "AXP", "BLK", "SCHW",
    "LLY", "NVO", "UNH", "ISRG", "VRTX", "REGN", "BIIB", "MRK", "ABBV", "PFE",
    "XOM", "CVX", "COP", "SLB", "EOG", "OXY", "HAL", "MPC", "PSX", "VLO",
    "CAT", "DE", "GE", "HON", "BA", "LMT", "RTX", "NOC", "GD", "ETN",
    "COST", "WMT", "TGT", "HD", "LOW", "TJX", "ROST", "NKE", "SBUX", "CMG",
    "DIS", "BKNG", "ABNB", "MAR", "HLT", "RCL", "CCL", "LVS", "WYNN", "DKNG",
    "FCX", "NEM", "SCCO", "AA", "CLF", "STLD", "NUE", "X", "ALB", "SQM",
    "SPY", "QQQ", "IWM", "SMH", "XBI", "XLE", "XLF", "XLK", "XLI", "XLV"
]

def fetch_ohlcv_from_lakehouse(ticker, lookback_days=150):
    """Fetches daily OHLCV bars from local DuckDB Parquet lakehouse."""
    if not os.path.exists(LAKEHOUSE_PATH):
        return None
    try:
        conn = duckdb.connect()
        query = f"""
            SELECT 
                Date,
                Open,
                High,
                Low,
                Close,
                Volume
            FROM read_parquet('{LAKEHOUSE_PATH}')
            WHERE UPPER(Ticker) = UPPER('{ticker}')
            ORDER BY Date ASC
        """
        df = conn.execute(query).df()
        conn.close()
        if df is not None and not df.empty and len(df) >= 30:
            df['Date'] = pd.to_datetime(df['Date'])
            df = df.sort_values('Date').reset_index(drop=True)
            if len(df) > lookback_days:
                df = df.iloc[-lookback_days:].reset_index(drop=True)
            return df
    except Exception:
        pass
    return None

def fetch_ohlcv_from_yfinance(ticker, lookback_days=150):
    """Fetches daily OHLCV bars from Yahoo Finance if lakehouse doesn't have it."""
    if yf is None:
        return None
    try:
        t = yf.Ticker(ticker)
        df = t.history(period="1y")
        if df is not None and not df.empty and len(df) >= 30:
            df = df.reset_index()
            date_col = 'Date' if 'Date' in df.columns else 'Datetime'
            df = df[[date_col, 'Open', 'High', 'Low', 'Close', 'Volume']].copy()
            df.columns = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume']
            df['Date'] = pd.to_datetime(df['Date']).dt.tz_localize(None)
            df = df.sort_values('Date').reset_index(drop=True)
            if len(df) > lookback_days:
                df = df.iloc[-lookback_days:].reset_index(drop=True)
            return df
    except Exception:
        return None
    return None

def get_stock_data(ticker, lookback_days=150):
    """Retrieves OHLCV data with fallback."""
    df = fetch_ohlcv_from_lakehouse(ticker, lookback_days=lookback_days)
    if df is None or len(df) < 30:
        df = fetch_ohlcv_from_yfinance(ticker, lookback_days=lookback_days)
    return df

def calculate_vsa_indicators(df):
    """Enriches OHLCV DataFrame with Volume Spread Analysis (VSA) indicators."""
    df = df.copy()
    df['Vol_SMA20'] = df['Volume'].rolling(window=20, min_periods=5).mean()
    df['RVOL'] = df['Volume'] / (df['Vol_SMA20'] + 1e-6)
    df['Spread'] = df['High'] - df['Low']
    df['ATR20'] = df['Spread'].rolling(window=20, min_periods=5).mean()
    df['Spread_Ratio'] = df['Spread'] / (df['ATR20'] + 1e-6)
    df['CLV'] = (df['Close'] - df['Low']) / (df['Spread'] + 1e-6)
    df['CLV'] = df['CLV'].clip(0.0, 1.0)
    df['Pct_Change'] = df['Close'].pct_change() * 100.0
    
    # 20-day Up/Down Volume Accumulation Flow
    is_up = df['Close'] >= df['Open']
    df['Up_Vol'] = np.where(is_up, df['Volume'], 0.0)
    df['Down_Vol'] = np.where(~is_up, df['Volume'], 0.0)
    
    # Volume Dry-Up (VDU) Index: 3-day volume vs 20-day SMA
    df['Vol_SMA3'] = df['Volume'].rolling(window=3, min_periods=1).mean()
    df['VDU_Index'] = df['Vol_SMA3'] / (df['Vol_SMA20'] + 1e-6)
    
    bar_evals = []
    for idx, row in df.iterrows():
        rvol = row['RVOL']
        spread_r = row['Spread_Ratio']
        clv = row['CLV']
        pct = row['Pct_Change']
        
        if pd.isna(rvol) or pd.isna(spread_r):
            bar_evals.append("Normal")
            continue
            
        if rvol >= 1.8 and spread_r >= 1.5 and clv >= 0.7:
            bar_evals.append("Strong Demand (Bullish Expansion)")
        elif rvol >= 1.8 and spread_r < 0.9 and clv >= 0.5:
            bar_evals.append("Absorption / Stopping Volume (High Effort, Hidden Demand)")
        elif rvol >= 1.8 and spread_r >= 1.5 and clv <= 0.3:
            bar_evals.append("Supply Expansion (Sign of Weakness)")
        elif rvol >= 1.8 and spread_r < 0.9 and clv <= 0.4:
            bar_evals.append("Churning / Distribution (High Effort, Poor Result)")
        elif rvol <= 0.65 and abs(pct) < 1.0:
            bar_evals.append("Volume Dry-Up / No Supply (VDU)")
        elif rvol <= 0.65 and pct > 0:
            bar_evals.append("No Demand Test")
        else:
            bar_evals.append("Neutral Volume")
            
    df['VSA_Class'] = bar_evals

    # David Weis Wave Cumulative Volume (CVD) - Canonical Clean ZigZag Segmentation
    n = len(df)
    wave_dir = np.zeros(n, dtype=int)
    wave_vol = np.zeros(n, dtype=float)
    wave_bars = np.zeros(n, dtype=int)
    wave_dp = np.zeros(n, dtype=float)
    
    if n >= 2:
        highs_arr = df['High'].values
        lows_arr = df['Low'].values
        closes_arr = df['Close'].values
        vols_arr = df['Volume'].values
        atr_arr = df['ATR20'].values
        
        cur_dir = 1 if closes_arr[1] >= closes_arr[0] else -1
        last_pivot_idx = 0
        cur_extreme_idx = 0
        waves = []  # List of tuples: (start_idx, end_idx, direction, start_price, end_price)
        
        for i in range(1, n):
            bar_atr = atr_arr[i] if not np.isnan(atr_arr[i]) and atr_arr[i] > 0 else (highs_arr[i] - lows_arr[i])
            rev_thresh = max(0.5, bar_atr * 1.5)
            
            if cur_dir == 1:
                if highs_arr[i] >= highs_arr[cur_extreme_idx]:
                    cur_extreme_idx = i
                if closes_arr[i] <= highs_arr[cur_extreme_idx] - rev_thresh:
                    # Confirmed reversal! UP wave completed at cur_extreme_idx
                    up_end = max(last_pivot_idx, cur_extreme_idx)
                    sp = lows_arr[last_pivot_idx - 1] if last_pivot_idx > 0 else lows_arr[last_pivot_idx]
                    ep = highs_arr[up_end]
                    waves.append((last_pivot_idx, up_end, 1, sp, ep))
                    last_pivot_idx = up_end + 1
                    cur_dir = -1
                    if last_pivot_idx <= i:
                        cur_extreme_idx = last_pivot_idx + int(np.argmin(lows_arr[last_pivot_idx : i + 1]))
                    else:
                        cur_extreme_idx = i
            else:
                if lows_arr[i] <= lows_arr[cur_extreme_idx]:
                    cur_extreme_idx = i
                if closes_arr[i] >= lows_arr[cur_extreme_idx] + rev_thresh:
                    # Confirmed reversal! DOWN wave completed at cur_extreme_idx
                    down_end = max(last_pivot_idx, cur_extreme_idx)
                    sp = highs_arr[last_pivot_idx - 1] if last_pivot_idx > 0 else highs_arr[last_pivot_idx]
                    ep = lows_arr[down_end]
                    waves.append((last_pivot_idx, down_end, -1, sp, ep))
                    last_pivot_idx = down_end + 1
                    cur_dir = 1
                    if last_pivot_idx <= i:
                        cur_extreme_idx = last_pivot_idx + int(np.argmax(highs_arr[last_pivot_idx : i + 1]))
                    else:
                        cur_extreme_idx = i
                        
        if last_pivot_idx < n:
            sp = lows_arr[last_pivot_idx - 1] if cur_dir == 1 and last_pivot_idx > 0 else highs_arr[last_pivot_idx - 1] if last_pivot_idx > 0 else closes_arr[0]
            waves.append((last_pivot_idx, n - 1, cur_dir, sp, closes_arr[-1]))
            
        # Populate per-bar series cleanly without retrospective lag or double counting
        for s_idx, e_idx, wdir, sp, ep in waves:
            running_vol = 0.0
            for k in range(s_idx, e_idx + 1):
                running_vol += vols_arr[k]
                wave_dir[k] = wdir
                wave_vol[k] = running_vol
                wave_bars[k] = k - s_idx + 1
                wave_dp[k] = round(closes_arr[k] - sp, 2)
                
    df['Weis_Wave_Dir'] = wave_dir
    df['Weis_Wave_Vol'] = wave_vol
    df['Weis_Wave_Bars'] = wave_bars
    df['Weis_Wave_DP'] = wave_dp
    return df

def identify_trading_range(df):
    """
    Identifies the institutional Trading Range (TR) dynamically:
      - Automatically detects the structural onset (Selling Climax / stopping pivot)
        so each stock gets its true unique Cause duration (bars & calendar days).
      - Computes 'The Creek' (Resistance) and 'The Ice' (Support).
      - Computes Multi-Tier Point & Figure Cause & Effect projections (Conservative T1, Base T2, Macro T3).
      - Computes Weis Wave cumulative volume metrics.
      - Calculates Range Position % and Up/Down Volume Accumulation ratio.
    """
    if len(df) < 30:
        return None
        
    last_idx = len(df) - 1
    lows = df['Low'].values
    highs = df['High'].values
    closes = df['Close'].values
    dates = df['Date'].values
    
    # 1. Detect structural swing lows to find the anchor / onset of the current consolidation base
    swing_lows = []
    for i in range(8, len(df) - 3):
        look = 3
        if lows[i] <= np.min(lows[max(0, i-look):i]) and lows[i] <= np.min(lows[i+1:min(len(df), i+look+1)]):
            swing_lows.append((i, lows[i], float(df.iloc[i].get('RVOL', 1.0)), dates[i]))
            
    # Search for the structural base anchor: deepest structural test within last 14 to 90 bars
    recent_swings = [s for s in swing_lows if 14 <= (last_idx - s[0]) <= 90]
    if recent_swings:
        deepest = min(recent_swings, key=lambda x: x[1])
        base_bars = last_idx - deepest[0]
        base_start_date = pd.to_datetime(deepest[3]).strftime('%Y-%m-%d')
        cal_days = (pd.to_datetime(dates[-1]) - pd.to_datetime(deepest[3])).days
        anchor_low = deepest[1]
    else:
        # Fallback: estimate base from ATR stabilization
        base_bars = min(45, len(df) - 5)
        cal_days = int(base_bars * 1.45)
        base_start_date = pd.to_datetime(dates[-base_bars]).strftime('%Y-%m-%d')
        anchor_low = float(np.min(lows[-base_bars:]))
        
    sub_df = df.iloc[-base_bars:]
    c_p88 = float(np.percentile(sub_df['High'], 88))
    i_p12 = float(np.percentile(sub_df['Low'], 12))
    abs_h = float(np.max(sub_df['High']))
    abs_l = float(np.min(sub_df['Low']))
    
    the_creek = round(c_p88 * 0.7 + abs_h * 0.3, 2)
    the_ice = round(i_p12 * 0.7 + abs_l * 0.3, 2)
    
    if the_creek <= the_ice:
        the_creek = round(abs_h, 2)
        the_ice = round(abs_l, 2)
        
    tr_height = round(the_creek - the_ice, 2)
    tr_height_pct = round((tr_height / the_ice) * 100.0, 2) if the_ice > 0 else 0.0
    mid_point = round((the_creek + the_ice) / 2.0, 2)
    
    curr_close = float(closes[-1])
    range_pos_pct = round(((curr_close - the_ice) / (tr_height + 1e-6)) * 100.0, 1)
    
    # Distance to collars
    dist_to_creek_pct = round(((the_creek - curr_close) / curr_close) * 100.0, 1)
    dist_to_ice_pct = round(((curr_close - the_ice) / curr_close) * 100.0, 1)
    
    # Up/Down Volume Accumulation Ratio over last 20 bars
    last20 = df.iloc[-min(20, len(df)):]
    up_vol_sum = last20['Up_Vol'].sum()
    down_vol_sum = last20['Down_Vol'].sum()
    up_down_ratio = round(up_vol_sum / (down_vol_sum + 1e-6), 2)
    
    # Point & Figure (P&F) Box Size and Multi-Tier Target Projections (Law of Cause and Effect)
    atr = float(df.iloc[-1].get('ATR20', tr_height / 10.0))
    box_size = round(max(0.5, atr * 0.75), 2)
    
    # 1. Conservative Target (T1 - Phase C/D swing count)
    pf_effect_t1 = round(base_bars * box_size * 0.20 + tr_height * 0.5, 2)
    pf_target_t1 = round(the_creek + pf_effect_t1, 2)
    pf_gain_t1 = round(((pf_target_t1 - curr_close) / curr_close) * 100.0, 1)

    # 2. Standard Base Target (T2 - Full Base count across TR)
    pf_effect_t2 = round(base_bars * box_size * 0.35 + tr_height, 2)
    pf_target_t2 = round(the_creek + pf_effect_t2, 2)
    pf_gain_t2 = round(((pf_target_t2 - curr_close) / curr_close) * 100.0, 1)

    # 3. Macro Secular Target (T3 - Multi-Cycle horizontal cause count)
    pf_effect_t3 = round(base_bars * box_size * 0.65 + tr_height * 1.6, 2)
    pf_target_t3 = round(the_creek + pf_effect_t3, 2)
    pf_gain_t3 = round(((pf_target_t3 - curr_close) / curr_close) * 100.0, 1)

    # Downside Distribution Markdown Projections (if The Ice fails)
    pf_down_t1 = round(the_ice - (base_bars * box_size * 0.20 + tr_height * 0.5), 2)
    pf_down_t1 = max(1.0, pf_down_t1)
    pf_down_gain_t1 = round(((pf_down_t1 - curr_close) / curr_close) * 100.0, 1)

    pf_down_t2 = round(the_ice - (base_bars * box_size * 0.35 + tr_height), 2)
    pf_down_t2 = max(1.0, pf_down_t2)
    pf_down_gain_t2 = round(((pf_down_t2 - curr_close) / curr_close) * 100.0, 1)

    pf_down_t3 = round(the_ice - (base_bars * box_size * 0.65 + tr_height * 1.6), 2)
    pf_down_t3 = max(1.0, pf_down_t3)
    pf_down_gain_t3 = round(((pf_down_t3 - curr_close) / curr_close) * 100.0, 1)

    pf_target = pf_target_t2
    pf_gain_pct = pf_gain_t2
    
    # Cause Potency (0-100%)
    potency_score = min(100, int(base_bars * 0.8 + (1.0 if up_down_ratio > 1.2 else 0.5) * 30))
    
    # Cause Maturity Classification
    if base_bars >= 75:
        maturity = "Multi-Month Secular Base"
    elif base_bars >= 45:
        maturity = "Prime Readiness"
    elif base_bars >= 25:
        maturity = "Forming Cause"
    else:
        maturity = "Early Incubation"

    # Weis Wave Analytics
    current_wave_dir = "DEMAND" if df.iloc[-1].get('Weis_Wave_Dir', 1) == 1 else "SUPPLY"
    current_wave_vol = float(df.iloc[-1].get('Weis_Wave_Vol', df.iloc[-1]['Volume']))
    current_wave_bars = int(df.iloc[-1].get('Weis_Wave_Bars', 1))
    current_wave_dp = float(df.iloc[-1].get('Weis_Wave_DP', 0.0))
    current_wave_dp_pct = round((current_wave_dp / (curr_close - current_wave_dp + 1e-6)) * 100.0, 1)
    
    # 1. Scan backwards to locate the immediate completed counter wave
    current_num_dir = df.iloc[-1].get('Weis_Wave_Dir', 1)
    counter_num_dir = -current_num_dir
    prior_counter_vol = current_wave_vol
    prior_counter_bars = 1
    prior_counter_dp = 0.0
    counter_found = False
    counter_end_k = -1
    
    for k in range(len(df) - 1, -1, -1):
        if df.iloc[k].get('Weis_Wave_Dir', current_num_dir) == counter_num_dir:
            prior_counter_vol = float(df.iloc[k].get('Weis_Wave_Vol', current_wave_vol))
            prior_counter_bars = int(df.iloc[k].get('Weis_Wave_Bars', 1))
            prior_counter_dp = float(df.iloc[k].get('Weis_Wave_DP', 0.0))
            counter_found = True
            counter_end_k = k
            break
            
    # 2. Scan further backwards to locate the prior wave of the SAME direction
    prior_same_vol = current_wave_vol
    prior_same_bars = 1
    prior_same_dp = 0.0
    same_found = False
    
    if counter_found and counter_end_k > 0:
        for k in range(counter_end_k, -1, -1):
            if df.iloc[k].get('Weis_Wave_Dir', counter_num_dir) == current_num_dir:
                prior_same_vol = float(df.iloc[k].get('Weis_Wave_Vol', current_wave_vol))
                prior_same_bars = int(df.iloc[k].get('Weis_Wave_Bars', 1))
                prior_same_dp = float(df.iloc[k].get('Weis_Wave_DP', 0.0))
                same_found = True
                break
                
    weis_ratio = round(current_wave_vol / (prior_counter_vol + 1e-6), 2)
    same_dir_ratio = round(current_wave_vol / (prior_same_vol + 1e-6), 2) if same_found else 1.0
    same_dir_dp_ratio = round(abs(current_wave_dp) / (abs(prior_same_dp) + 1e-6), 2) if same_found else 1.0
    is_emerging = current_wave_bars <= 2
    effort_result = round((current_wave_vol / 1e6) / (abs(current_wave_dp) + 0.1), 1)

    # Canonical Shortening of the Thrust (SOT)
    sot_detected = same_found and (same_dir_dp_ratio <= 0.65) and (same_dir_ratio >= 0.85) and (current_wave_bars >= 3)

    if is_emerging:
        weis_status = f"Emerging {current_wave_dir} Leg ({current_wave_bars}b, {current_wave_vol/1e6:.1f}M) — monitoring volume follow-through"
    elif current_wave_dir == "DEMAND":
        if sot_detected:
            weis_status = f"Shortening of Thrust (SOT): {same_dir_ratio:.1f}x vol of prior demand wave with only {int(same_dir_dp_ratio*100)}% price travel (+${current_wave_dp:.2f} vs +${prior_same_dp:.2f})"
        elif weis_ratio >= 1.25:
            weis_status = f"Demand Wave Dominance ({weis_ratio:.1f}x vs prior supply wave, +${abs(current_wave_dp):.2f})"
        elif weis_ratio <= 0.65:
            weis_status = f"Low-Volume Demand Test ({weis_ratio:.1f}x vs prior supply wave, +${abs(current_wave_dp):.2f})"
        else:
            weis_status = f"Steady Demand Advance ({weis_ratio:.1f}x volume, +${abs(current_wave_dp):.2f})"
    else: # SUPPLY
        if sot_detected:
            weis_status = f"Shortening of Downward Thrust: {same_dir_ratio:.1f}x vol with only {int(same_dir_dp_ratio*100)}% price travel (-${abs(current_wave_dp):.2f} vs -${abs(prior_same_dp):.2f})"
        elif weis_ratio <= 0.65:
            weis_status = f"Supply Wave Exhaustion / Low-Volume Test ({weis_ratio:.1f}x vs demand wave, -${abs(current_wave_dp):.2f})"
        elif weis_ratio >= 1.25:
            weis_status = f"Supply Wave Expansion ({weis_ratio:.1f}x volume vs demand wave, -${abs(current_wave_dp):.2f})"
        else:
            weis_status = f"Normal Retracement Leg ({weis_ratio:.1f}x volume, {current_wave_bars}b)"
        
    return {
        'creek': the_creek,
        'ice': the_ice,
        'mid': mid_point,
        'tr_height': tr_height,
        'tr_height_pct': tr_height_pct,
        'cause_bars': base_bars,
        'cause_days': cal_days,
        'cause_start_date': base_start_date,
        'range_pos_pct': range_pos_pct,
        'dist_to_creek_pct': dist_to_creek_pct,
        'dist_to_ice_pct': dist_to_ice_pct,
        'up_down_vol_ratio': up_down_ratio,
        'box_size': box_size,
        'pf_target': pf_target,
        'pf_gain_pct': pf_gain_pct,
        'pf_target_t1': pf_target_t1,
        'pf_gain_t1': pf_gain_t1,
        'pf_target_t2': pf_target_t2,
        'pf_gain_t2': pf_gain_t2,
        'pf_target_t3': pf_target_t3,
        'pf_gain_t3': pf_gain_t3,
        'multi_tier_targets': {
            't1': {'name': 'Conservative (T1)', 'target': pf_target_t1, 'gain_pct': pf_gain_t1, 'basis': 'Phase C-D Count'},
            't2': {'name': 'Standard Base (T2)', 'target': pf_target_t2, 'gain_pct': pf_gain_t2, 'basis': 'Full Horizontal Cause'},
            't3': {'name': 'Macro Secular (T3)', 'target': pf_target_t3, 'gain_pct': pf_gain_t3, 'basis': 'Multi-Cycle Projection'}
        },
        'pf_down_t1': pf_down_t1,
        'pf_down_gain_t1': pf_down_gain_t1,
        'pf_down_t2': pf_down_t2,
        'pf_down_gain_t2': pf_down_gain_t2,
        'pf_down_t3': pf_down_t3,
        'pf_down_gain_t3': pf_down_gain_t3,
        'multi_tier_downside_targets': {
            't1': {'name': 'Breakdown Test (T1)', 'target': pf_down_t1, 'gain_pct': pf_down_gain_t1, 'basis': 'Ice Breach Count'},
            't2': {'name': 'Full Distribution Base (T2)', 'target': pf_down_t2, 'gain_pct': pf_down_gain_t2, 'basis': 'Full Horizontal Cause Markdown'},
            't3': {'name': 'Secular Markdown (T3)', 'target': pf_down_t3, 'gain_pct': pf_down_gain_t3, 'basis': 'Multi-Cycle Distribution Count'}
        },
        'cause_potency': potency_score,
        'cause_maturity': maturity,
        'vdu_index': round(float(df.iloc[-1].get('VDU_Index', 1.0)), 2),
        'weis_wave': {
            'wave_dir': current_wave_dir,
            'wave_vol_m': round(current_wave_vol / 1e6, 2),
            'prior_vol_m': round(prior_counter_vol / 1e6, 2),
            'prior_same_vol_m': round(prior_same_vol / 1e6, 2) if same_found else round(current_wave_vol / 1e6, 2),
            'wave_bars': current_wave_bars,
            'price_change': current_wave_dp,
            'price_change_pct': current_wave_dp_pct,
            'effort_result': effort_result,
            'ratio': weis_ratio,
            'same_dir_ratio': same_dir_ratio,
            'same_dir_dp_ratio': same_dir_dp_ratio,
            'sot_detected': sot_detected,
            'status': weis_status,
            'is_emerging': is_emerging
        }
    }

def detect_wyckoff_setups(ticker, df):
    """
    Evaluates Wyckoff structural footprints and classifies setups with dynamic Cause metrics
    across Richard Wyckoff's canonical Phase A, Phase B, Phase C (Schematic #1 & #2), Phase D, and Phase E.
    """
    if df is None or len(df) < 30:
        return None
        
    df = calculate_vsa_indicators(df)
    tr = identify_trading_range(df)
    if not tr:
        return None
        
    creek = tr['creek']
    ice = tr['ice']
    mid = tr['mid']
    height = tr['tr_height']
    base_bars = tr['cause_bars']
    cal_days = tr['cause_days']
    pf_target = tr['pf_target']
    pf_gain_pct = tr['pf_gain_pct']
    pf_target_t1 = tr.get('pf_target_t1', pf_target)
    pf_gain_t1 = tr.get('pf_gain_t1', pf_gain_pct)
    pf_target_t2 = tr.get('pf_target_t2', pf_target)
    pf_gain_t2 = tr.get('pf_gain_t2', pf_gain_pct)
    pf_target_t3 = tr.get('pf_target_t3', pf_target)
    pf_gain_t3 = tr.get('pf_gain_t3', pf_gain_pct)
    pf_down_t1 = tr.get('pf_down_t1', round(ice * 0.95, 2))
    pf_down_gain_t1 = tr.get('pf_down_gain_t1', -5.0)
    pf_down_t2 = tr.get('pf_down_t2', round(ice * 0.90, 2))
    pf_down_gain_t2 = tr.get('pf_down_gain_t2', -10.0)
    pf_down_t3 = tr.get('pf_down_t3', round(ice * 0.80, 2))
    pf_down_gain_t3 = tr.get('pf_down_gain_t3', -20.0)
    up_down_vol = tr['up_down_vol_ratio']
    range_pos = tr['range_pos_pct']
    vdu_index = tr.get('vdu_index', 1.0)
    
    curr = df.iloc[-1]
    prev1 = df.iloc[-2]
    
    current_close = float(curr['Close'])
    rvol = float(curr['RVOL']) if not pd.isna(curr['RVOL']) else 1.0
    clv = float(curr['CLV']) if not pd.isna(curr['CLV']) else 0.5
    spread_ratio = float(curr['Spread_Ratio']) if not pd.isna(curr['Spread_Ratio']) else 1.0
    atr = float(curr.get('ATR20', height / 10.0))
    
    # Moving Averages & 52-Week Macro Context
    sma20 = float(df['Close'].rolling(20, min_periods=5).mean().iloc[-1])
    sma50 = float(df['Close'].rolling(50, min_periods=10).mean().iloc[-1])
    high_1y = float(df['High'].max())
    low_1y = float(df['Low'].min())
    dd_from_high = (current_close - high_1y) / (high_1y + 1e-6) * 100.0
    pos_in_52w = (current_close - low_1y) / ((high_1y - low_1y) + 1e-6) * 100.0
    
    recent_6 = df.iloc[-6:]
    min_recent_low = float(recent_6['Low'].min())
    max_recent_high = float(recent_6['High'].max())
    
    detected_setups = []
    primary_setup = None
    wyckoff_phase = "Phase B (Consolidation)"
    phase_letter = 'B'
    wyckoff_score = 50
    effort_result_bias = "Neutral"

    # =========================================================================
    # 1. DISTRIBUTION: SOW (Sign of Weakness) Breakdown (Phase D Markdown)
    # =========================================================================
    broke_ice = current_close < ice * 0.985
    expanding_down_vol = rvol >= 1.25 and clv <= 0.35
    if broke_ice and (expanding_down_vol or current_close < ice * 0.97):
        confidence = 88 if expanding_down_vol else 80
        entry = round(current_close, 2)
        stop_loss = round(ice * 1.025, 2)
        risk = max(0.01, stop_loss - entry)
        target1 = round(ice, 2)
        target2 = round(pf_down_t2, 2)
        rr_ratio = round((entry - target1) / risk, 2) if risk > 0 else 2.6
        
        detected_setups.append({
            'setup_key': 'sow',
            'name': 'Sign of Weakness (SOW)',
            'phase': 'Phase D (Markdown Breakdown)',
            'phase_letter': 'D',
            'sub_type': 'Fall Through The Ice',
            'direction': 'BEARISH',
            'confidence': confidence,
            'entry': entry,
            'stop_loss': stop_loss,
            'target_1': target1,
            'target_1_label': 'The Ice Breakdown (T1)',
            'target_2': target2,
            'target_2_label': 'Markdown P&F Count (T2)',
            'macro_pf_target': round(pf_down_t3, 2),
            'macro_pf_gain': pf_down_gain_t3,
            'risk_reward': rr_ratio,
            'description': f"Markdown initiation! Stock broke down through The Ice support (${ice:.2f}) on heavy volume ({rvol:.1f}x). Floating demand has vanished, activating Point & Figure markdown targets."
        })
        wyckoff_phase = "Phase D (SOW Markdown)"
        phase_letter = 'D'
        wyckoff_score = 20
        effort_result_bias = "Supply Expansion / Breakdown (Bearish)"

    # =========================================================================
    # 2. DISTRIBUTION: UTAD (Upthrust After Distribution) (Phase C Trap)
    # =========================================================================
    spiked_creek = max_recent_high > creek * 1.012
    failed_rejection = current_close < creek * 0.998 and (clv <= 0.40 or float(prev1['CLV']) <= 0.35)
    is_distribution_location = (pos_in_52w >= 50.0) or (dd_from_high > -22.0)
    has_heavy_supply = (up_down_vol <= 0.88) or (current_close < sma50 and up_down_vol <= 1.0)
    
    if spiked_creek and failed_rejection and is_distribution_location and has_heavy_supply and not detected_setups:
        confidence = 88
        entry = round(current_close, 2)
        stop_loss = round(max_recent_high * 1.015, 2)
        risk = max(0.01, stop_loss - entry)
        target1 = round(ice, 2)
        target2 = round(pf_down_t1, 2)
        rr_ratio = round((entry - target1) / risk, 2) if risk > 0 else 2.8
        
        detected_setups.append({
            'setup_key': 'utad',
            'name': 'Upthrust After Distribution (UTAD)',
            'phase': 'Phase C (Distribution Trap)',
            'phase_letter': 'C',
            'sub_type': 'Bull Trap / Rejection',
            'direction': 'BEARISH',
            'confidence': confidence,
            'entry': entry,
            'stop_loss': stop_loss,
            'target_1': target1,
            'target_1_label': 'The Ice Support (T1)',
            'target_2': target2,
            'target_2_label': 'Distribution Breakdown (T2)',
            'macro_pf_target': round(pf_down_t2, 2),
            'macro_pf_gain': pf_down_gain_t2,
            'risk_reward': rr_ratio,
            'description': f"Distribution trap! Spiked above Buying Climax resistance (BC ${creek:.2f}) up to ${max_recent_high:.2f} but rejected hard back into range on heavy supply ({up_down_vol}x vol flow, pos in 52W: {pos_in_52w:.1f}%). Institutional distribution footprint after {base_bars} bars of building cause targeting breakdown through The Ice (${ice:.2f})."
        })
        wyckoff_phase = "Phase C (UTAD Trap)"
        phase_letter = 'C'
        wyckoff_score = 28
        effort_result_bias = "Upthrust Rejection (Bearish Distribution)"

    # =========================================================================
    # 3. ACCUMULATION: PHASE E - Unfolded Markup Trend (Above Creek Expansion)
    # =========================================================================
    is_above_creek = current_close >= creek * 1.015
    trend_aligned = (current_close > sma20) and (sma20 >= sma50 * 0.99)
    sustained_above = (recent_6['Close'] >= creek * 0.998).sum() >= 4
    
    if is_above_creek and (trend_aligned or sustained_above) and not detected_setups:
        confidence = 94 if (trend_aligned and up_down_vol >= 1.05) else 86
        entry = round(current_close, 2)
        stop_loss = round(max(creek * 0.98, current_close - 2.0 * atr), 2)
        risk = max(0.01, entry - stop_loss)
        target1 = round(pf_target_t1, 2)
        target2 = round(pf_target_t2, 2)
        rr_ratio = round((target1 - entry) / risk, 2) if risk > 0 else 3.2
        
        detected_setups.append({
            'setup_key': 'phase_e_markup',
            'name': 'Phase E Markup Trend',
            'phase': 'Phase E (Unfolded Markup)',
            'phase_letter': 'E',
            'sub_type': 'Runaway Expansion',
            'direction': 'BULLISH',
            'confidence': confidence,
            'entry': entry,
            'stop_loss': stop_loss,
            'target_1': target1,
            'target_1_label': 'Conservative P&F (T1)',
            'target_2': target2,
            'target_2_label': 'Standard Base P&F (T2)',
            'macro_pf_target': round(pf_target_t3, 2),
            'macro_pf_gain': pf_gain_t3,
            'risk_reward': rr_ratio,
            'description': f"Accumulation cause has fully transitioned into Phase E markup! Stock is sustaining an active trend above The Creek (${creek:.2f}) with bullish moving average alignment. Institutional demand in open market expansion."
        })
        wyckoff_phase = "Phase E (Unfolded Markup)"
        phase_letter = 'E'
        wyckoff_score = max(wyckoff_score, 94)
        effort_result_bias = "Unfolded Markup / Open Trend Expansion (Bullish)"

    # =========================================================================
    # 4. ACCUMULATION: PHASE C - Springs (Schematic #1) & LPS (Schematic #2)
    # =========================================================================
    # Look back over recent 15 bars for a Spring shakeout below Ice
    recent_15 = df.iloc[-15:]
    spring_bar_info = None
    for idx_pos, (idx_val, b) in enumerate(recent_15.iterrows()):
        if b['Low'] < ice * 0.998 and (b['Close'] >= ice * 0.990 or current_close >= ice * 0.995):
            # Record historical spring bar details
            global_idx = df.index.get_loc(idx_val) if hasattr(df.index, 'get_loc') else int(df.index.get_loc(idx_val))
            date_str = b['Date'].strftime('%Y-%m-%d') if hasattr(b['Date'], 'strftime') else str(b['Date'])
            spring_bar_info = {
                'index': global_idx,
                'date': date_str,
                'low': round(float(b['Low']), 2),
                'rvol': float(b['RVOL']) if not pd.isna(b['RVOL']) else 1.0
            }
            break

    if spring_bar_info is not None and current_close >= ice and not detected_setups:
        # Check if price has already advanced into upper/mid range -> Phase D transition!
        is_phase_d_advance = range_pos >= 45.0 or current_close >= (ice + creek) / 2.0
        
        spring_type = "Type 2 (Low-Volume Test)" if spring_bar_info['rvol'] < 1.1 else "Type 1 (Stopping Shakeout)"
        confidence = 90 if current_close > ice * 1.01 else 82
        entry = round(current_close, 2)
        stop_loss = round(min_recent_low * 0.985, 2)
        risk = max(0.01, entry - stop_loss)
        target1 = round(creek, 2)
        target2 = round(pf_target_t1, 2)
        rr_ratio = round((target1 - entry) / risk, 2) if risk > 0 else 3.0
        
        if is_phase_d_advance:
            setup_key = 'phase_d_post_spring'
            phase_name = 'Phase D (Post-Spring Markup)'
            phase_ltr = 'D'
            desc = f"Phase D Sign of Strength advance following Phase C Spring! Price pierced SC support (${ice:.2f}) down to ${spring_bar_info['low']:.2f} on {spring_bar_info['date']} and has advanced to {range_pos:.1f}% range position (${current_close:.2f})."
        else:
            setup_key = 'spring'
            phase_name = 'Phase C (Spring)'
            phase_ltr = 'C'
            desc = f"Bear trap identified! Price pierced Selling Climax support (${ice:.2f}) down to ${spring_bar_info['low']:.2f} on {spring_bar_info['date']} and immediately reclaimed the range. {spring_type} confirms exhausted supply after {base_bars} bars ({cal_days}d) of cause."

        detected_setups.append({
            'setup_key': setup_key,
            'name': 'Post-Spring Markup (Phase D)' if is_phase_d_advance else 'Spring / Shakeout',
            'phase': phase_name,
            'phase_letter': phase_ltr,
            'sub_type': spring_type,
            'direction': 'BULLISH',
            'confidence': confidence,
            'entry': entry,
            'stop_loss': stop_loss,
            'target_1': target1,
            'target_1_label': 'The Creek Target (T1)',
            'target_2': target2,
            'target_2_label': 'Post-Spring Expansion (T2)',
            'macro_pf_target': round(pf_target_t2, 2),
            'macro_pf_gain': pf_gain_t2,
            'risk_reward': rr_ratio,
            'spring_bar_idx': spring_bar_info['index'],
            'spring_bar_date': spring_bar_info['date'],
            'spring_bar_low': spring_bar_info['low'],
            'description': desc
        })
        wyckoff_phase = phase_name
        phase_letter = phase_ltr
        wyckoff_score = max(wyckoff_score, 88)
        effort_result_bias = "Post-Spring Demand Advance (Bullish)" if is_phase_d_advance else "Smart Money Absorption (Bullish)"

    # Schematic #2: Phase C LPS (Higher Low Test on VDU without Spring)
    tested_lower_tr = (min_recent_low >= ice * 0.995) and (min_recent_low <= ice + 0.48 * height)
    vdu_confirmed = (rvol <= 0.92 or vdu_index <= 0.85 or (recent_6['RVOL'] <= 0.78).any())
    turning_up = (clv >= 0.45 or current_close > prev1['Close']) and base_bars >= 18
    still_in_test_range = range_pos <= 62.0
    
    if tested_lower_tr and vdu_confirmed and turning_up and still_in_test_range and not detected_setups:
        confidence = 85
        entry = round(current_close, 2)
        stop_loss = round(min_recent_low * 0.985, 2)
        risk = max(0.01, entry - stop_loss)
        target1 = round(creek, 2)
        target2 = round(pf_target_t1, 2)
        rr_ratio = round((target1 - entry) / risk, 2) if risk > 0 else 3.1
        
        dist_to_ice = ((min_recent_low - ice) / ice) * 100.0
        detected_setups.append({
            'setup_key': 'phase_c_lps',
            'name': 'Phase C Last Point of Support (LPS)',
            'phase': 'Phase C (The Test: LPS)',
            'phase_letter': 'C',
            'sub_type': 'Schematic #2 Dry Higher Low',
            'direction': 'BULLISH',
            'confidence': confidence,
            'entry': entry,
            'stop_loss': stop_loss,
            'target_1': target1,
            'target_1_label': 'The Creek Target (T1)',
            'target_2': target2,
            'target_2_label': 'Phase D Expansion (T2)',
            'macro_pf_target': round(pf_target_t2, 2),
            'macro_pf_gain': pf_gain_t2,
            'risk_reward': rr_ratio,
            'description': f"Wyckoff Accumulation Schematic #2 confirmed! Formed a clean higher-low test at ${min_recent_low:.2f} ({dist_to_ice:.1f}% above SC support ${ice:.2f}) on Volume Dry-Up ({rvol:.2f}x RVOL, VDU: {vdu_index:.2f}x). Sellers are exhausted without needing a spring break."
        })
        wyckoff_phase = "Phase C (LPS Higher Low Test)"
        phase_letter = 'C'
        wyckoff_score = max(wyckoff_score, 85)
        effort_result_bias = "Volume Dry-Up / Supply Exhaustion (Bullish)"

    # =========================================================================
    # =========================================================================
    # 5. ACCUMULATION: PHASE D - Transition to Markup (SOS / LPS / JAC / BUEC)
    # =========================================================================
    # Wyckoff Law of Cause and Effect: Phase D represents the transition into markup
    # AFTER substantial Cause (Phase B) has been built across the trading range.
    has_sufficient_cause = base_bars >= 25 or range_pos >= 75.0 or current_close >= creek * 0.98

    # Prior SOS Jump across Creek in recent 25 bars
    prior_sos = any(df.iloc[-25:]['Close'] >= creek * 0.995) or any(df.iloc[-25:]['High'] >= creek * 1.005)
    near_creek_support = (abs(current_close - creek) / (creek + 1e-6) <= 0.045) or (current_close >= creek * 0.955 and current_close <= creek * 1.045)
    volume_digesting = (rvol <= 1.35 and spread_ratio <= 1.50) or (clv >= 0.35) or (current_close >= creek * 0.98)
    is_pulling_back_from_sos = max_recent_high >= creek * 1.005 and current_close < max_recent_high * 0.99

    # Case D2: Back-Up to the Edge of the Creek (BUEC / LPS) - Stock jumped Creek and is retesting support
    if has_sufficient_cause and prior_sos and near_creek_support and is_pulling_back_from_sos and not detected_setups:
        confidence = 90
        entry = round(current_close, 2)
        stop_loss = round(creek * 0.95, 2)
        risk = max(0.01, entry - stop_loss)
        target1 = round(pf_target_t1, 2)
        target2 = round(pf_target_t2, 2)
        rr_ratio = round((target1 - entry) / risk, 2) if risk > 0 else 3.2
        
        detected_setups.append({
            'setup_key': 'lps',
            'name': 'Back-Up to Creek (BUEC / LPS)',
            'phase': 'Phase D (Back-Up Retest)',
            'phase_letter': 'D',
            'sub_type': 'Back-Up to Edge of Creek (BUEC)',
            'direction': 'BULLISH',
            'confidence': confidence,
            'entry': entry,
            'stop_loss': stop_loss,
            'target_1': target1,
            'target_1_label': 'Phase D Continuation (T1)',
            'target_2': target2,
            'target_2_label': 'Standard Base P&F (T2)',
            'macro_pf_target': round(pf_target_t3, 2),
            'macro_pf_gain': pf_gain_t3,
            'risk_reward': rr_ratio,
            'description': f"Low-risk continuation entry! Jumped Creek to ${max_recent_high:.2f} and is now testing broken Creek resistance (${creek:.2f}) as new support on digesting volume ({rvol:.2f}x). Confirms old resistance has flipped to support."
        })
        wyckoff_phase = "Phase D (BUEC / LPS Retest)"
        phase_letter = 'D'
        wyckoff_score = max(wyckoff_score, 89)
        effort_result_bias = "Supply Exhaustion / VDU at Creek (Bullish)"

    # Case D1: Breaking / testing Creek on expanding volume (SOS / JAC)
    is_breaking_creek = (current_close >= creek * 0.992) or (float(prev1['Close']) >= creek * 0.992) or (max_recent_high >= creek * 1.005 and range_pos >= 80.0)
    high_volume_break = (rvol >= 1.15) or (float(prev1['RVOL']) >= 1.15) or ((recent_6['RVOL'] >= 1.25).any())
    bullish_spread = (clv >= 0.40) or (float(prev1['CLV']) >= 0.50) or (current_close >= creek * 0.995)
    
    if has_sufficient_cause and is_breaking_creek and (high_volume_break or current_close >= creek) and bullish_spread and not detected_setups:
        confidence = 92 if rvol >= 1.6 else 85
        entry = round(current_close, 2)
        stop_loss = round(ice + 0.7 * height, 2)
        risk = max(0.01, entry - stop_loss)
        target1 = round(pf_target_t1, 2)
        target2 = round(pf_target_t2, 2)
        rr_ratio = round((target1 - entry) / risk, 2) if risk > 0 else 2.8
        
        detected_setups.append({
            'setup_key': 'sos',
            'name': 'Sign of Strength (SOS / JAC)',
            'phase': 'Phase D (Markup Entry)',
            'phase_letter': 'D',
            'sub_type': 'Jump Across The Creek',
            'direction': 'BULLISH',
            'confidence': confidence,
            'entry': entry,
            'stop_loss': stop_loss,
            'target_1': target1,
            'target_1_label': 'Phase D Expansion (T1)',
            'target_2': target2,
            'target_2_label': 'Standard Base P&F (T2)',
            'macro_pf_target': round(pf_target_t3, 2),
            'macro_pf_gain': pf_gain_t3,
            'risk_reward': rr_ratio,
            'description': f"Institutional expansion! Stock jumped across The Creek (${creek:.2f}) on {rvol:.1f}x relative volume. Built {base_bars} bars ({cal_days}d) of cause with {up_down_vol}x up-volume accumulation."
        })
        wyckoff_phase = "Phase D (SOS Breakout)"
        phase_letter = 'D'
        wyckoff_score = max(wyckoff_score, 90)
        effort_result_bias = "High Demand Effort, Strong Result (Bullish)"

    # Case D2b: Fallback Back-Up to the Edge of the Creek (BU / LPS) if not caught above
    if has_sufficient_cause and prior_sos and near_creek_support and volume_digesting and not detected_setups:
        confidence = 88
        entry = round(current_close, 2)
        stop_loss = round(creek * 0.95, 2)
        risk = max(0.01, entry - stop_loss)
        target1 = round(pf_target_t1, 2)
        target2 = round(pf_target_t2, 2)
        rr_ratio = round((target1 - entry) / risk, 2) if risk > 0 else 3.2
        
        detected_setups.append({
            'setup_key': 'lps',
            'name': 'Back-Up to Creek (BUEC / LPS)',
            'phase': 'Phase D (Back-Up Retest)',
            'phase_letter': 'D',
            'sub_type': 'Back-Up to Edge of Creek (BUEC)',
            'direction': 'BULLISH',
            'confidence': confidence,
            'entry': entry,
            'stop_loss': stop_loss,
            'target_1': target1,
            'target_1_label': 'Phase D Continuation (T1)',
            'target_2': target2,
            'target_2_label': 'Standard Base P&F (T2)',
            'macro_pf_target': round(pf_target_t3, 2),
            'macro_pf_gain': pf_gain_t3,
            'risk_reward': rr_ratio,
            'description': f"Low-risk continuation entry! Testing broken Creek resistance (${creek:.2f}) as new support on dry volume ({rvol:.2f}x). Confirms old resistance has flipped to support."
        })
        wyckoff_phase = "Phase D (BUEC / LPS Retest)"
        phase_letter = 'D'
        wyckoff_score = max(wyckoff_score, 88)
        effort_result_bias = "Supply Exhaustion / VDU at Creek (Bullish)"

    # Case D3: Phase D Internal Markup Advance (requires mature cause)
    advancing_upper_range = has_sufficient_cause and range_pos >= 65.0 and base_bars >= 42
    favorable_demand = (up_down_vol >= 1.05) or (current_close > sma20 and pos_in_52w >= 45.0)
    
    if advancing_upper_range and favorable_demand and not detected_setups:
        confidence = 83
        entry = round(current_close, 2)
        stop_loss = round(mid * 0.98, 2)
        risk = max(0.01, entry - stop_loss)
        target1 = round(creek, 2)
        target2 = round(pf_target_t1, 2)
        rr_ratio = round((target1 - entry) / risk, 2) if risk > 0 else 2.6
        
        detected_setups.append({
            'setup_key': 'markup_advance',
            'name': 'Phase D Markup Advance',
            'phase': 'Phase D (Internal Markup)',
            'phase_letter': 'D',
            'sub_type': 'Advancing to Creek',
            'direction': 'BULLISH',
            'confidence': confidence,
            'entry': entry,
            'stop_loss': stop_loss,
            'target_1': target1,
            'target_1_label': 'The Creek Target (T1)',
            'target_2': target2,
            'target_2_label': 'Post-JAC Objective (T2)',
            'macro_pf_target': round(pf_target_t2, 2),
            'macro_pf_gain': pf_gain_t2,
            'risk_reward': rr_ratio,
            'description': f"Phase D momentum expansion inside the trading range! Stock is advancing towards The Creek (${creek:.2f}) at {range_pos:.1f}% TR position with dominant institutional buying flow ({up_down_vol}x volume accumulation)."
        })
        wyckoff_phase = "Phase D (Internal Markup)"
        phase_letter = 'D'
        wyckoff_score = max(wyckoff_score, 82)
        effort_result_bias = "Demand Wave Dominance (Bullish)"

    # Case D4: Phase D Upper Range Guardrail (requires mature cause)
    if has_sufficient_cause and range_pos >= 78.0 and not detected_setups:
        confidence = 82
        entry = round(current_close, 2)
        stop_loss = round(ice + 0.65 * height, 2)
        risk = max(0.01, entry - stop_loss)
        target1 = round(creek * 1.01, 2)
        target2 = round(pf_target_t1, 2)
        rr_ratio = round((target1 - entry) / risk, 2) if risk > 0 else 2.5
        
        detected_setups.append({
            'setup_key': 'markup_advance',
            'name': 'Phase D Markup Advance',
            'phase': 'Phase D (Internal Markup)',
            'phase_letter': 'D',
            'sub_type': 'Testing The Creek',
            'direction': 'BULLISH',
            'confidence': confidence,
            'entry': entry,
            'stop_loss': stop_loss,
            'target_1': target1,
            'target_1_label': 'The Creek Target (T1)',
            'target_2': target2,
            'target_2_label': 'Post-JAC Objective (T2)',
            'macro_pf_target': round(pf_target_t2, 2),
            'macro_pf_gain': pf_gain_t2,
            'risk_reward': rr_ratio,
            'description': f"Phase D momentum expansion inside the trading range! Stock has rallied to {range_pos:.1f}% TR position near The Creek (${creek:.2f}) after building {base_bars} bars ({cal_days}d) of cause. Floating supply absorbed; transitioning into markup."
        })
        wyckoff_phase = "Phase D (Internal Markup)"
        phase_letter = 'D'
        wyckoff_score = max(wyckoff_score, 82)
        effort_result_bias = "Markup Advance / Supply Absorbed (Bullish)"

    # Case B1: Young Base Advancing / Building Cause at Resistance
    if not has_sufficient_cause and range_pos >= 60.0 and not detected_setups:
        confidence = 82
        entry = round(current_close, 2)
        stop_loss = round(ice + 0.5 * height, 2)
        risk = max(0.01, entry - stop_loss)
        target1 = round(creek, 2)
        target2 = round(pf_target_t1, 2)
        rr_ratio = round((target1 - entry) / risk, 2) if risk > 0 else 2.4
        
        detected_setups.append({
            'setup_key': 'absorption',
            'name': 'Supply Absorption (Phase B)',
            'phase': 'Phase B (Building Cause)',
            'phase_letter': 'B',
            'sub_type': 'Testing Resistance in Phase B',
            'direction': 'BULLISH',
            'confidence': confidence,
            'entry': entry,
            'stop_loss': stop_loss,
            'target_1': target1,
            'target_1_label': 'Creek Ceiling (T1)',
            'target_2': target2,
            'target_2_label': 'Conservative P&F (T2)',
            'macro_pf_target': round(pf_target_t2, 2),
            'macro_pf_gain': pf_gain_t2,
            'risk_reward': rr_ratio,
            'description': f"Developing accumulation base ({base_bars} bars / {cal_days}d). Stock completed its initial relief rally off Selling Climax (${ice:.2f}) to establish The Creek (${creek:.2f}) and is now building Phase B horizontal cause to absorb overhead floating supply."
        })
        wyckoff_phase = "Phase B (Absorption / Building Cause)"
        phase_letter = 'B'
        wyckoff_score = 78
        effort_result_bias = "Phase B Cause Building / Supply Absorption"

    # =========================================================================
    # 6. ACCUMULATION: PHASE A - Stopping Action (SC / AR / ST Active)
    # =========================================================================
    is_young_base = base_bars <= 25
    is_near_stopping_zone = range_pos <= 45.0 or (current_close <= ice + 0.40 * height)
    
    if is_young_base and is_near_stopping_zone and not detected_setups:
        confidence = 74
        entry = round(current_close, 2)
        stop_loss = round(ice * 0.97, 2)
        risk = max(0.01, entry - stop_loss)
        target1 = round(mid, 2)
        target2 = round(creek, 2)
        rr_ratio = round((target1 - entry) / risk, 2) if risk > 0 else 2.2
        
        detected_setups.append({
            'setup_key': 'stopping_action',
            'name': 'Phase A Stopping Action',
            'phase': 'Phase A (Stopping Action)',
            'phase_letter': 'A',
            'sub_type': 'SC / AR / ST Formation',
            'direction': 'NEUTRAL_BULLISH',
            'confidence': confidence,
            'entry': entry,
            'stop_loss': stop_loss,
            'target_1': target1,
            'target_1_label': 'Range Midpoint (T1)',
            'target_2': target2,
            'target_2_label': 'The Creek Resistance (T2)',
            'macro_pf_target': round(pf_target_t2, 2),
            'macro_pf_gain': pf_gain_t2,
            'risk_reward': rr_ratio,
            'description': f"Prior markdown halted by institutional stopping action! Establishing the trading range collars (Selling Climax support ${ice:.2f}, Automatic Rally ${creek:.2f}). Currently forming secondary tests to absorb residual selling."
        })
        wyckoff_phase = "Phase A (Stopping Action)"
        phase_letter = 'A'
        wyckoff_score = 65
        effort_result_bias = "Stopping Action Absorption (Phase A)"

    # =========================================================================
    # 7. PHASE B: Building Cause & Consolidation
    # =========================================================================
    if not detected_setups:
        # Check for Supply Absorption coiling at Creek
        in_upper_bracket = current_close >= (ice + 0.72 * height) and current_close <= (creek * 1.01)
        recent_5_closes = df.iloc[-5:]['Close'].values
        tight_range = (np.max(recent_5_closes) - np.min(recent_5_closes)) / (current_close + 1e-6) < 0.048
        
        if in_upper_bracket and tight_range and clv >= 0.42:
            confidence = 80
            entry = round(current_close, 2)
            stop_loss = round(ice + 0.5 * height, 2)
            risk = max(0.01, entry - stop_loss)
            target1 = round(creek * 1.02, 2)
            target2 = round(pf_target_t1, 2)
            rr_ratio = round((target1 - entry) / risk, 2) if risk > 0 else 2.5
            
            detected_setups.append({
                'setup_key': 'absorption',
                'name': 'Supply Absorption',
                'phase': 'Phase B/C (Pre-Breakout)',
                'phase_letter': 'B',
                'sub_type': 'Coiling at The Creek',
                'direction': 'BULLISH',
                'confidence': confidence,
                'entry': entry,
                'stop_loss': stop_loss,
                'target_1': target1,
                'target_1_label': 'Creek Breakout Pivot (T1)',
                'target_2': target2,
                'target_2_label': 'Conservative P&F (T2)',
                'macro_pf_target': round(pf_target_t2, 2),
                'macro_pf_gain': pf_gain_t2,
                'risk_reward': rr_ratio,
                'description': f"Institutional absorption underway! Price is hovering tightly under The Creek (${creek:.2f}) for {base_bars} bars ({cal_days}d), absorbing floating supply before markup."
            })
            wyckoff_phase = "Phase B/C (Absorption)"
            phase_letter = 'B'
            wyckoff_score = max(wyckoff_score, 78)
            effort_result_bias = "Absorption at Resistance (Bullish)"
        elif current_close >= mid:
            wyckoff_phase = "Phase B (Building Cause)"
            phase_letter = 'B'
            wyckoff_score = 62
            effort_result_bias = "Upper Range Equilibrium"
            primary_setup = {
                'setup_key': 'base_acc',
                'name': 'Base Accumulation (TR)',
                'phase': 'Phase B (Building Cause)',
                'phase_letter': 'B',
                'sub_type': 'Upper Trading Range',
                'direction': 'NEUTRAL_BULLISH',
                'confidence': 65,
                'entry': round(current_close, 2),
                'stop_loss': round(ice * 0.98, 2),
                'target_1': round(creek, 2),
                'target_1_label': 'The Creek Resistance (T1)',
                'target_2': round(pf_target_t1, 2),
                'target_2_label': 'Phase C/D Expansion (T2)',
                'macro_pf_target': round(pf_target_t2, 2),
                'macro_pf_gain': pf_gain_t2,
                'risk_reward': 2.1,
                'description': f"Stock is building cause inside an established Trading Range between ${ice:.2f} and ${creek:.2f} for {base_bars} bars ({cal_days}d). Tactical targets reflect intra-range bounds; secular P&F target (${pf_target:.2f}, +{pf_gain_pct}%) activates upon Phase D confirmation (Jump Across the Creek)."
            }
            detected_setups.append(primary_setup)
        else:
            wyckoff_phase = "Phase B (Consolidation)"
            phase_letter = 'B'
            wyckoff_score = 48
            effort_result_bias = "Lower Range Consolidation"
            primary_setup = {
                'setup_key': 'base_neut',
                'name': 'Range Consolidation',
                'phase': 'Phase B (Consolidation)',
                'phase_letter': 'B',
                'sub_type': 'Lower Trading Range',
                'direction': 'NEUTRAL',
                'confidence': 50,
                'entry': round(current_close, 2),
                'stop_loss': round(ice * 0.97, 2),
                'target_1': round(mid, 2),
                'target_1_label': 'Range Midpoint (T1)',
                'target_2': round(creek, 2),
                'target_2_label': 'The Creek Resistance (T2)',
                'macro_pf_target': round(pf_target_t2, 2),
                'macro_pf_gain': pf_gain_t2,
                'risk_reward': 1.8,
                'description': f"Trading inside lower range band for {base_bars} bars ({cal_days}d). Tactical targets reflect intra-range mean reversion. Secular Point & Figure target (${pf_target:.2f}, +{pf_gain_pct}%) activates only upon Phase D confirmation (Jump Across the Creek). Monitor for Phase C test (Spring or LPS)."
            }
            detected_setups.append(primary_setup)

    detected_setups.sort(key=lambda s: s['confidence'], reverse=True)
    primary_setup = detected_setups[0]

    direction = primary_setup.get('direction', 'BULLISH')
    is_bearish = direction == 'BEARISH'
    is_phase_b = phase_letter == 'B' or 'Phase B' in wyckoff_phase

    if is_bearish:
        tr['effect_type'] = 'MARKDOWN'
        tr['upper_collar_name'] = 'Buying Climax (BC) / Supply Resistance'
        tr['lower_collar_name'] = 'The Ice (Breakdown Pivot)'
    elif is_phase_b:
        tr['effect_type'] = 'CONDITIONAL_PHASE_B'
        tr['upper_collar_name'] = 'Range Ceiling (Preliminary Supply)'
        tr['lower_collar_name'] = 'Range Floor (Preliminary Support)'
    else:
        tr['effect_type'] = 'MARKUP'
        tr['upper_collar_name'] = 'The Creek (Jump Resistance)'
        tr['lower_collar_name'] = 'The Ice / Primary Support'

    return {
        'ticker': ticker,
        'current_price': round(current_close, 2),
        'pct_change': round(float(curr['Pct_Change']), 2),
        'trading_range': tr,
        'rvol': round(rvol, 2),
        'spread_ratio': round(float(curr['Spread_Ratio']), 2),
        'clv': round(clv, 2),
        'wyckoff_phase': wyckoff_phase,
        'phase_letter': phase_letter,
        'wyckoff_score': wyckoff_score,
        'effort_result_bias': effort_result_bias,
        'primary_setup': primary_setup,
        'all_setups': detected_setups
    }

def compute_wyckoff_phase_progression(wyckoff_phase, setup_key, base_bars, current_close, creek, ice, phase_letter=None, direction='BULLISH'):
    """Computes Wyckoff Phase A-E progression, completion percentage, and active criteria with 100% phase synchronization and distinct Accumulation vs Distribution schematics."""
    current_price = current_close
    if not phase_letter:
        if 'Phase E' in wyckoff_phase or setup_key in ['phase_e_markup', 'phase_e_markdown']:
            phase_letter = 'E'
        elif 'Phase D' in wyckoff_phase or setup_key in ['sos', 'lps', 'markup_advance', 'sow']:
            phase_letter = 'D'
        elif 'Phase C' in wyckoff_phase or setup_key in ['spring', 'phase_c_lps', 'utad']:
            phase_letter = 'C'
        elif 'Phase A' in wyckoff_phase or setup_key == 'stopping_action':
            phase_letter = 'A'
        else:
            phase_letter = 'B'

    is_distribution = (direction == 'BEARISH') or (setup_key in ['utad', 'sow', 'lpsy', 'phase_e_markdown']) or ('Markdown' in wyckoff_phase)

    if is_distribution:
        schematic_type = 'DISTRIBUTION'
        if setup_key == 'utad':
            schematic_name = 'Wyckoff Distribution Schematic #1 (UTAD Climax Trap)'
        elif setup_key == 'sow':
            schematic_name = 'Wyckoff Distribution Schematic #2 (SOW Ice Breakdown)'
        elif phase_letter == 'E':
            schematic_name = 'Wyckoff Distribution Schematic (Phase E Markdown)'
        else:
            schematic_name = 'Wyckoff Distribution Schematic (Phase B Supply Building)'

        phases = [
            {'id': 'A', 'name': 'Phase A', 'role': 'Stopping Action', 'events': 'PSY • BC • AR • ST'},
            {'id': 'B', 'name': 'Phase B', 'role': 'Building Cause', 'events': 'Distribution • UT'},
            {'id': 'C', 'name': 'Phase C', 'role': 'The Test', 'events': 'UTAD • Terminal Trap'},
            {'id': 'D', 'name': 'Phase D', 'role': 'Markdown in Range', 'events': 'SOW • LPSY • Breakdown'},
            {'id': 'E', 'name': 'Phase E', 'role': 'Runaway Markdown', 'events': 'Waterfall • Markdown'}
        ]

        if phase_letter == 'E':
            phase_title = 'Phase E (Unfolded Markdown Cascade)'
            progress_pct = 100
            desc = "Runaway markdown phase underway outside and beneath the distribution range in cascading downward expansion."
            checklist = [
                {'title': 'Phase A: Stopping Action (PSY/BC/AR/ST)', 'done': True},
                {'title': 'Phase B: Horizontal Cause (Distribution)', 'done': True},
                {'title': 'Phase C: Upthrust Trap Confirmed (UTAD)', 'done': True},
                {'title': 'Phase D: Ice Support Breached (SOW)', 'done': True},
                {'title': 'Phase E: Sustained Markdown Cascade', 'done': True, 'active': True}
            ]
        elif phase_letter == 'D':
            phase_title = 'Phase D (Supply Dominance & Ice Breakdown)'
            progress_pct = 85
            desc = "Supply has completely overwhelmed demand. Price breaking through The Ice support with Signs of Weakness (SOW) and failed rallies (LPSY)."
            checklist = [
                {'title': 'Phase A: Stopping Action (PSY/BC/AR/ST)', 'done': True},
                {'title': 'Phase B: Horizontal Cause (Distribution)', 'done': True},
                {'title': 'Phase C: Upthrust Trap Confirmed', 'done': True},
                {'title': 'Phase D: Breakdown Below Ice (SOW/LPSY)', 'done': True, 'active': True},
                {'title': 'Phase E: Sustained Markdown Trend', 'done': False}
            ]
        elif phase_letter == 'C':
            phase_title = 'Phase C (The Distribution Test - UTAD)'
            progress_pct = 70
            desc = "Terminal distribution trap! Price staged an Upthrust After Distribution (UTAD) piercing above Buying Climax resistance to trap late buyers before the markdown cascade."
            checklist = [
                {'title': 'Phase A: Stopping Action (PSY/BC/AR/ST)', 'done': True},
                {'title': 'Phase B: Horizontal Cause (Distribution)', 'done': True},
                {'title': 'Phase C: Boundary Test Active (UTAD)', 'done': True, 'active': True},
                {'title': 'Phase D: Breakdown Below Ice (SOW)', 'done': False},
                {'title': 'Phase E: Sustained Markdown Trend', 'done': False}
            ]
        elif phase_letter == 'A':
            phase_title = 'Phase A (Stopping Prior Uptrend)'
            progress_pct = 20
            desc = "Halting prior markup via Preliminary Supply (PSY), Buying Climax (BC), Automatic Reaction (AR), and Secondary Test (ST)."
            checklist = [
                {'title': 'Phase A: Stopping Action (PSY/BC/AR/ST)', 'done': True, 'active': True},
                {'title': 'Phase B: Horizontal Cause (Distribution)', 'done': False},
                {'title': 'Phase C: Boundary Supply Test (UTAD)', 'done': False},
                {'title': 'Phase D: Breakdown Below Ice (SOW)', 'done': False},
                {'title': 'Phase E: Sustained Markdown Trend', 'done': False}
            ]
        else: # Phase B
            phase_title = 'Phase B (Building Distribution Cause)'
            progress_pct = 45
            desc = f"Institutional distribution in progress. Smart money liquidating inventory ({base_bars} bars) and testing buyer exhaustion with upthrusts (UT)."
            checklist = [
                {'title': 'Phase A: Stopping Action (PSY/BC/AR/ST)', 'done': True},
                {'title': 'Phase B: Horizontal Cause (Distribution)', 'done': True, 'active': True},
                {'title': 'Phase C: Boundary Supply Test (UTAD)', 'done': False},
                {'title': 'Phase D: Breakdown Below Ice (SOW)', 'done': False},
                {'title': 'Phase E: Sustained Markdown Trend', 'done': False}
            ]

    else: # ACCUMULATION
        schematic_type = 'ACCUMULATION'
        if setup_key == 'spring':
            schematic_name = 'Wyckoff Accumulation Schematic #1 (Spring & Shakeout)'
        elif setup_key in ['sos', 'lps', 'markup_advance']:
            schematic_name = 'Wyckoff Accumulation Schematic #2 (LPS & Creek Breakout)'
        elif phase_letter == 'B':
            schematic_name = 'Wyckoff Consolidation Schematic (Phase B Range Trading)'
        else:
            schematic_name = 'Wyckoff Accumulation Schematic (Markup Expansion)'

        phases = [
            {'id': 'A', 'name': 'Phase A', 'role': 'Stopping Action', 'events': 'PS • SC • AR • ST'},
            {'id': 'B', 'name': 'Phase B', 'role': 'Building Cause', 'events': 'Absorption • TR'},
            {'id': 'C', 'name': 'Phase C', 'role': 'The Test', 'events': 'Spring • LPS Test'},
            {'id': 'D', 'name': 'Phase D', 'role': 'Markup in Range', 'events': 'SOS • BUEC / LPS'},
            {'id': 'E', 'name': 'Phase E', 'role': 'Runaway Trend', 'events': 'Expansion • Markup'}
        ]

        if phase_letter == 'E':
            phase_title = 'Phase E (Unfolded Markup Expansion)'
            progress_pct = 100
            desc = "Runaway markup phase underway outside and above the accumulation base in open market expansion."
            checklist = [
                {'title': 'Phase A: Stopping Action (SC/AR/ST)', 'done': True},
                {'title': 'Phase B: Horizontal Cause Built', 'done': True},
                {'title': 'Phase C: Boundary Test Confirmed', 'done': True},
                {'title': 'Phase D: Jump Across Creek (SOS / JAC)', 'done': True},
                {'title': 'Phase D: Back-Up to Creek (BUEC / LPS)', 'done': True},
                {'title': 'Phase E: Sustained Markup Trend', 'done': True, 'active': True}
            ]
        elif phase_letter == 'D':
            is_buec = (setup_key in ['lps', 'buec']) or (current_price <= creek * 1.035 and setup_key != 'markup_advance')
            if is_buec:
                phase_title = 'Phase D (Back-Up to Creek - BUEC / LPS)'
                progress_pct = 90
                desc = "Demand has overcome supply. Price completed the Jump Across The Creek (SOS / JAC) and is now executing a Back-Up to Creek / Last Point of Support (BUEC / LPS) retest to confirm Creek as new support."
                checklist = [
                    {'title': 'Phase A: Stopping Action (SC/AR/ST)', 'done': True},
                    {'title': 'Phase B: Horizontal Cause Built', 'done': True},
                    {'title': 'Phase C: Boundary Test Confirmed', 'done': True},
                    {'title': 'Phase D: Jump Across Creek (SOS / JAC)', 'done': True},
                    {'title': 'Phase D: Back-Up to Creek (BUEC / LPS)', 'done': True, 'active': True},
                    {'title': 'Phase E: Sustained Markup Trend', 'done': False}
                ]
            else:
                phase_title = 'Phase D (Jump Across Creek - SOS / JAC)'
                progress_pct = 82
                desc = "Demand has overcome supply. Price is staging a high-momentum Sign of Strength (SOS / JAC) breakout across The Creek resistance."
                checklist = [
                    {'title': 'Phase A: Stopping Action (SC/AR/ST)', 'done': True},
                    {'title': 'Phase B: Horizontal Cause Built', 'done': True},
                    {'title': 'Phase C: Boundary Test Confirmed', 'done': True},
                    {'title': 'Phase D: Jump Across Creek (SOS / JAC)', 'done': True, 'active': True},
                    {'title': 'Phase D: Back-Up to Creek (BUEC / LPS)', 'done': False},
                    {'title': 'Phase E: Sustained Markup Trend', 'done': False}
                ]
        elif phase_letter == 'C':
            phase_title = 'Phase C (The Definitive Test)'
            progress_pct = 70
            desc = "Testing floating supply at boundary. Spring/LPS confirms lack of selling pressure before markup."
            checklist = [
                {'title': 'Phase A: Stopping Action (SC/AR/ST)', 'done': True},
                {'title': 'Phase B: Horizontal Cause Built', 'done': True},
                {'title': 'Phase C: Boundary Test Active', 'done': True, 'active': True},
                {'title': 'Phase D: Jump Across Creek (SOS / JAC)', 'done': False},
                {'title': 'Phase D: Back-Up to Creek (BUEC / LPS)', 'done': False},
                {'title': 'Phase E: Sustained Markup Trend', 'done': False}
            ]
        elif phase_letter == 'A':
            phase_title = 'Phase A (Stopping Action)'
            progress_pct = 20
            desc = "Halting prior markdown via Selling Climax (SC), Automatic Rally (AR), and Secondary Test (ST)."
            checklist = [
                {'title': 'Phase A: Stopping Action (SC/AR/ST)', 'done': True, 'active': True},
                {'title': 'Phase B: Horizontal Cause Building', 'done': False},
                {'title': 'Phase C: Boundary Supply Test', 'done': False},
                {'title': 'Phase D: Jump Across Creek (SOS / JAC)', 'done': False},
                {'title': 'Phase D: Back-Up to Creek (BUEC / LPS)', 'done': False},
                {'title': 'Phase E: Sustained Markup Trend', 'done': False}
            ]
        else: # Phase B
            phase_title = 'Phase B (Building Cause)'
            progress_pct = 45
            desc = f"Institutional accumulation in progress. Building horizontal cause ({base_bars} bars) while digesting floating supply."
            checklist = [
                {'title': 'Phase A: Stopping Action (SC/AR/ST)', 'done': True},
                {'title': 'Phase B: Horizontal Cause Building', 'done': True, 'active': True},
                {'title': 'Phase C: Boundary Supply Test', 'done': False},
                {'title': 'Phase D: Jump Across Creek (SOS / JAC)', 'done': False},
                {'title': 'Phase D: Back-Up to Creek (BUEC / LPS)', 'done': False},
                {'title': 'Phase E: Sustained Markup Trend', 'done': False}
            ]

    return {
        'current_phase': phase_letter,
        'schematic_type': schematic_type,
        'schematic_name': schematic_name,
        'phase_title': phase_title,
        'progress_pct': progress_pct,
        'description': desc,
        'checklist': checklist,
        'phases': phases
    }

def generate_annotated_chart_data(df, setup_result, limit_bars=260):
    """Constructs serialized candlestick and volume data with rich Wyckoff Phase A-E event markers."""
    if df is None or len(df) == 0:
        return {'candles': [], 'markers': []}

    if len(df) > limit_bars:
        df = df.iloc[-limit_bars:].reset_index(drop=True)

    tr = setup_result['trading_range']
    creek = tr['creek']
    ice = tr['ice']
    mid = tr['mid']
    base_bars = tr['cause_bars']
    primary = setup_result.get('primary_setup', {})
    direction = primary.get('direction', 'BULLISH')
    effect_type = tr.get('effect_type', 'MARKDOWN' if direction == 'BEARISH' else 'MARKUP')
    is_distribution = (direction == 'BEARISH') or (effect_type == 'MARKDOWN')
    
    candles = []
    markers = []
    
    highs = df['High'].values
    lows = df['Low'].values
    closes = df['Close'].values
    
    # 1. Base Window & Phase A Stopping Action Detection
    onset_idx = max(0, len(df) - base_bars)
    base_window = df.iloc[onset_idx:].reset_index(drop=True)
    if len(base_window) >= 6:
        if is_distribution:
            # DISTRIBUTION: Phase A stops the prior uptrend (PSY -> BC -> AR -> ST)
            # Find Buying Climax (BC) in early window of base
            bc_search_len = max(5, int(len(base_window) * 0.50))
            bc_local_idx = int(base_window.iloc[:bc_search_len]['High'].idxmax())
            bc_global_idx = onset_idx + bc_local_idx
            bc_date = df.iloc[bc_global_idx]['Date'].strftime('%Y-%m-%d')
            bc_price = round(float(highs[bc_global_idx]), 2)

            # Always mark Buying Climax (BC)
            markers.append({
                'index': bc_global_idx,
                'date': bc_date,
                'price': bc_price,
                'label': 'BC',
                'name': 'Buying Climax',
                'position': 'above',
                'color': '#ef4444'
            })

            # Base onset anchor only if separated from BC by at least 5 bars
            if bc_global_idx - onset_idx >= 5:
                markers.append({
                    'index': onset_idx,
                    'date': df.iloc[onset_idx]['Date'].strftime('%Y-%m-%d'),
                    'price': round(float(highs[onset_idx]), 2),
                    'label': 'DIST ONSET',
                    'name': 'Distribution Window Anchor',
                    'position': 'above',
                    'color': '#f59e0b'
                })

            # Preliminary Supply (PSY) before BC: Must have High < BC_price
            psy_search_start = max(0, bc_global_idx - 20)
            psy_search_end = max(0, bc_global_idx - 1)
            if psy_search_end > psy_search_start:
                pre_window = df.iloc[psy_search_start:psy_search_end]
                # ENFORCE: PSY high must be strictly less than BC high
                valid_psy_bars = pre_window[pre_window['High'] < bc_price]
                if not valid_psy_bars.empty:
                    # Pick high volume or peak swing high before BC
                    high_vol = valid_psy_bars[valid_psy_bars['RVOL'] >= 1.15]
                    target_bars = high_vol if not high_vol.empty else valid_psy_bars
                    psy_idx = int(target_bars['High'].idxmax())
                    markers.append({
                        'index': psy_idx,
                        'date': df.iloc[psy_idx]['Date'].strftime('%Y-%m-%d'),
                        'price': round(float(highs[psy_idx]), 2),
                        'label': 'PSY',
                        'name': 'Preliminary Supply',
                        'position': 'above',
                        'color': '#f59e0b'
                    })

            # Automatic Reaction (AR) following BC:
            # AR is established as the reaction drop directly reacting off BC
            ar_search_start = bc_global_idx + 1
            ar_search_end = min(len(df) - 1, bc_global_idx + 18)
            if ar_search_end > ar_search_start:
                post_bc = df.iloc[ar_search_start:ar_search_end]
                ar_idx = int(post_bc['Low'].idxmin())
                ar_date = df.iloc[ar_idx]['Date'].strftime('%Y-%m-%d')
                ar_price = round(float(lows[ar_idx]), 2)
                markers.append({
                    'index': ar_idx,
                    'date': ar_date,
                    'price': ar_price,
                    'label': 'AR',
                    'name': 'Automatic Reaction',
                    'position': 'below',
                    'color': '#f43f5e'
                })

                # Secondary Test (ST) following AR
                st_search_start = ar_idx + 1
                st_search_end = min(len(df) - 1, ar_idx + 20)
                if st_search_end > st_search_start:
                    post_ar = df.iloc[st_search_start:st_search_end]
                    st_idx = int(post_ar['High'].idxmax())
                    st_date = df.iloc[st_idx]['Date'].strftime('%Y-%m-%d')
                    st_price = round(float(highs[st_idx]), 2)
                    markers.append({
                        'index': st_idx,
                        'date': st_date,
                        'price': st_price,
                        'label': 'ST',
                        'name': 'Secondary Test (Supply)',
                        'position': 'above',
                        'color': '#fbbf24'
                    })

        else:
            # ACCUMULATION: Phase A stops the prior downtrend (PS -> SC -> AR -> ST)
            # Find Selling Climax (SC) in early window of base (avoiding Phase C Springs)
            sc_search_len = max(6, int(len(base_window) * 0.50))
            sc_local_idx = int(base_window.iloc[:sc_search_len]['Low'].idxmin())
            sc_global_idx = onset_idx + sc_local_idx
            sc_date = df.iloc[sc_global_idx]['Date'].strftime('%Y-%m-%d')
            sc_price = round(float(lows[sc_global_idx]), 2)
            
            # Always mark Selling Climax (SC)
            markers.append({
                'index': sc_global_idx,
                'date': sc_date,
                'price': sc_price,
                'label': 'SC',
                'name': 'Selling Climax',
                'position': 'below',
                'color': '#ef4444'
            })

            # Base onset anchor only if separated from SC by at least 5 bars
            if sc_global_idx - onset_idx >= 5:
                markers.append({
                    'index': onset_idx,
                    'date': df.iloc[onset_idx]['Date'].strftime('%Y-%m-%d'),
                    'price': round(float(lows[onset_idx]), 2),
                    'label': 'ACCUM ONSET',
                    'name': 'Accumulation Anchor',
                    'position': 'below',
                    'color': '#38bdf8'
                })
                
            # Preliminary Support (PS) before SC:
            # ENFORCE: SC MUST be a lower low than PS (i.e. PS low > SC low)
            ps_search_start = max(0, sc_global_idx - 20)
            ps_search_end = max(0, sc_global_idx - 1)
            if ps_search_end > ps_search_start:
                pre_window = df.iloc[ps_search_start:ps_search_end]
                # ENFORCE STRICT RULE: PS low must be strictly greater than SC low
                valid_ps_bars = pre_window[pre_window['Low'] > sc_price]
                if not valid_ps_bars.empty:
                    # Pick high RVOL bar or swing low where initial demand emerged before SC
                    high_vol = valid_ps_bars[valid_ps_bars['RVOL'] >= 1.15]
                    target_bars = high_vol if not high_vol.empty else valid_ps_bars
                    ps_idx = int(target_bars['Low'].idxmin())
                    markers.append({
                        'index': ps_idx,
                        'date': df.iloc[ps_idx]['Date'].strftime('%Y-%m-%d'),
                        'price': round(float(lows[ps_idx]), 2),
                        'label': 'PS',
                        'name': 'Preliminary Support',
                        'position': 'below',
                        'color': '#f59e0b'
                    })
                    
            # Automatic Rally (AR) following SC:
            # AR is established as the reaction rally directly following SC (peak of initial relief surge)
            ar_search_start = sc_global_idx + 1
            ar_search_end = min(len(df) - 1, sc_global_idx + 18)
            if ar_search_end > ar_search_start:
                post_sc = df.iloc[ar_search_start:ar_search_end]
                ar_idx = int(post_sc['High'].idxmax())
                ar_date = df.iloc[ar_idx]['Date'].strftime('%Y-%m-%d')
                ar_price = round(float(highs[ar_idx]), 2)
                markers.append({
                    'index': ar_idx,
                    'date': ar_date,
                    'price': ar_price,
                    'label': 'AR',
                    'name': 'Automatic Rally',
                    'position': 'above',
                    'color': '#10b981'
                })
                
                # Secondary Test (ST) following AR:
                # ST tests supply by pulling back from AR towards SC
                st_search_start = ar_idx + 1
                st_search_end = min(len(df) - 1, ar_idx + 20)
                if st_search_end > st_search_start:
                    post_ar = df.iloc[st_search_start:st_search_end]
                    st_idx = int(post_ar['Low'].idxmin())
                    st_date = df.iloc[st_idx]['Date'].strftime('%Y-%m-%d')
                    st_price = round(float(lows[st_idx]), 2)
                    markers.append({
                        'index': st_idx,
                        'date': st_date,
                        'price': st_price,
                        'label': 'ST',
                        'name': 'Secondary Test',
                        'position': 'below',
                        'color': '#38bdf8'
                    })
    elif onset_idx < len(df):
        markers.append({
            'index': onset_idx,
            'date': df.iloc[onset_idx]['Date'].strftime('%Y-%m-%d'),
            'price': round(float(highs[onset_idx] if is_distribution else lows[onset_idx]), 2),
            'label': 'DIST ONSET' if is_distribution else 'ACCUM ONSET',
            'name': 'Distribution Window Anchor' if is_distribution else 'Accumulation Anchor',
            'position': 'above' if is_distribution else 'below',
            'color': '#f59e0b' if is_distribution else '#38bdf8'
        })

    # 3. Setup Specific Markers on Recent Action
    last_idx = len(df) - 1
    last_date = df.iloc[-1]['Date'].strftime('%Y-%m-%d')
    p_setup = setup_result['primary_setup']
    p_key = p_setup.get('setup_key', '')
    
    if p_key in ['spring', 'phase_d_post_spring']:
        spring_date = p_setup.get('spring_bar_date', last_date)
        # Match by date string in sliced df if present, otherwise fallback
        date_matches = df[df['Date'].astype(str).str.contains(spring_date)] if 'Date' in df.columns else []
        if len(date_matches) > 0:
            spring_idx = int(df.index.get_loc(date_matches.index[0]))
        else:
            spring_idx = min(last_idx, max(0, p_setup.get('spring_bar_idx', last_idx)))
        spring_low = p_setup.get('spring_bar_low', round(float(df.iloc[spring_idx]['Low']), 2))
        
        markers.append({
            'index': spring_idx,
            'date': spring_date,
            'price': spring_low,
            'label': 'SPRING',
            'name': 'Spring / Shakeout',
            'position': 'below',
            'color': '#10b981'
        })
    elif p_key == 'phase_c_lps':
        markers.append({
            'index': last_idx,
            'date': last_date,
            'price': round(float(df.iloc[-1]['Low']), 2),
            'label': 'LPS (Phase C)',
            'name': 'Phase C Last Point of Support',
            'position': 'below',
            'color': '#a855f7'
        })
    elif p_key in ['sos', 'lps']:
        # Phase D (SOS / JAC & BUEC / LPS) occurs strictly AFTER Phase A and intervening Phase B cause.
        # Find where Phase A finished (ST or AR) so we don't accidentally pick Phase A candles.
        st_marker = next((m for m in markers if m['label'] == 'ST'), None)
        ar_marker = next((m for m in markers if m['label'] == 'AR'), None)
        
        if st_marker:
            phase_d_start = st_marker['index'] + 1
        elif ar_marker:
            phase_d_start = ar_marker['index'] + 12
        else:
            phase_d_start = max(0, len(df) - 30)
        
        # Ensure valid non-empty window
        phase_d_start = min(phase_d_start, len(df) - 2)
        post_phase_a = df.iloc[phase_d_start:]
        
        if len(post_phase_a) >= 2:
            if p_key == 'lps':
                # Back-Up to Creek (BUEC / LPS): Stock made a prior Jump Across Creek (SOS), followed by a pullback retest (LPS)
                # 1. Identify prior SOS Jump Across Creek before recent retest
                prior_window = post_phase_a.iloc[:-2] if len(post_phase_a) >= 5 else post_phase_a
                creek_candidates = prior_window[prior_window['High'] >= creek * 0.97]
                if not creek_candidates.empty:
                    sos_global_idx = int(creek_candidates['High'].idxmax())
                else:
                    sos_global_idx = int(prior_window['High'].idxmax())
                
                sos_high = round(float(df.iloc[sos_global_idx]['High']), 2)
                sos_date = df.iloc[sos_global_idx]['Date'].strftime('%Y-%m-%d')
                
                markers.append({
                    'index': sos_global_idx,
                    'date': sos_date,
                    'price': sos_high,
                    'label': 'SOS / JAC',
                    'name': 'Jump Across The Creek',
                    'position': 'above',
                    'color': '#3b82f6'
                })
                
                # 2. Identify the Back-Up (BUEC / LPS) pullback low following the SOS jump
                if sos_global_idx < last_idx:
                    post_sos = df.iloc[sos_global_idx + 1:]
                    lps_global_idx = int(post_sos['Low'].idxmin())
                    lps_low = round(float(df.iloc[lps_global_idx]['Low']), 2)
                    lps_date = df.iloc[lps_global_idx]['Date'].strftime('%Y-%m-%d')
                    
                    markers.append({
                        'index': lps_global_idx,
                        'date': lps_date,
                        'price': lps_low,
                        'label': 'BUEC / LPS',
                        'name': 'Back-Up to Creek (LPS)',
                        'position': 'below',
                        'color': '#a855f7'
                    })
                else:
                    markers.append({
                        'index': last_idx,
                        'date': last_date,
                        'price': round(float(df.iloc[-1]['Low']), 2),
                        'label': 'BUEC / LPS',
                        'name': 'Back-Up to Creek (LPS)',
                        'position': 'below',
                        'color': '#a855f7'
                    })
            else:
                # Sign of Strength (SOS / JAC Breakout):
                sos_global_idx = int(post_phase_a['High'].idxmax())
                sos_high = round(float(df.iloc[sos_global_idx]['High']), 2)
                sos_date = df.iloc[sos_global_idx]['Date'].strftime('%Y-%m-%d')
                
                markers.append({
                    'index': sos_global_idx,
                    'date': sos_date,
                    'price': sos_high,
                    'label': 'SOS / JAC',
                    'name': 'Jump Across The Creek',
                    'position': 'above',
                    'color': '#3b82f6'
                })
                
                # If price consolidated or pulled back after the initial breakout jump
                if sos_global_idx < last_idx:
                    post_sos = df.iloc[sos_global_idx + 1:]
                    lps_global_idx = int(post_sos['Low'].idxmin())
                    lps_low = round(float(df.iloc[lps_global_idx]['Low']), 2)
                    lps_date = df.iloc[lps_global_idx]['Date'].strftime('%Y-%m-%d')
                    
                    markers.append({
                        'index': lps_global_idx,
                        'date': lps_date,
                        'price': lps_low,
                        'label': 'BUEC / LPS',
                        'name': 'Back-Up to Creek (LPS)',
                        'position': 'below',
                        'color': '#a855f7'
                    })
    elif p_key == 'markup_advance':
        markers.append({
            'index': last_idx,
            'date': last_date,
            'price': round(float(df.iloc[-1]['High']), 2),
            'label': 'MARKUP (Phase D)',
            'name': 'Phase D Markup Advance',
            'position': 'above',
            'color': '#38bdf8'
        })
    elif p_key == 'phase_e_markup':
        markers.append({
            'index': last_idx,
            'date': last_date,
            'price': round(float(df.iloc[-1]['High']), 2),
            'label': 'PHASE E MARKUP',
            'name': 'Phase E Markup Trend',
            'position': 'above',
            'color': '#10b981'
        })
    elif p_key == 'stopping_action':
        markers.append({
            'index': last_idx,
            'date': last_date,
            'price': round(float(df.iloc[-1]['Low']), 2),
            'label': 'PHASE A STOPPING',
            'name': 'Phase A Stopping Action',
            'position': 'below',
            'color': '#f59e0b'
        })
    elif p_key == 'absorption':
        markers.append({
            'index': last_idx,
            'date': last_date,
            'price': round(float(df.iloc[-1]['High']), 2),
            'label': 'ABSORPTION',
            'name': 'Supply Absorption at Creek',
            'position': 'above',
            'color': '#38bdf8'
        })
    elif p_key == 'utad':
        markers.append({
            'index': last_idx,
            'date': last_date,
            'price': round(float(df.iloc[-1]['High']), 2),
            'label': 'UTAD',
            'name': 'Upthrust After Distribution',
            'position': 'above',
            'color': '#f43f5e'
        })
    elif p_key == 'phase_b_st':
        markers.append({
            'index': last_idx,
            'date': last_date,
            'price': round(float(df.iloc[-1]['High']), 2),
            'label': 'ST (Phase B)',
            'name': 'Phase B Resistance Test',
            'position': 'above',
            'color': '#60a5fa'
        })
    elif p_key == 'sow':
        markers.append({
            'index': last_idx,
            'date': last_date,
            'price': round(float(df.iloc[-1]['Low']), 2),
            'label': 'SOW',
            'name': 'Sign of Weakness',
            'position': 'below',
            'color': '#f43f5e'
        })

    # Sort markers by index to maintain chronological order
    markers.sort(key=lambda m: m['index'])

    for i, row in df.iterrows():
        d_str = row['Date'].strftime('%Y-%m-%d') if hasattr(row['Date'], 'strftime') else str(row['Date'])[:10]
        candles.append({
            'date': d_str,
            'open': round(float(row['Open']), 2),
            'high': round(float(row['High']), 2),
            'low': round(float(row['Low']), 2),
            'close': round(float(row['Close']), 2),
            'volume': int(row['Volume']),
            'rvol': round(float(row['RVOL']), 2) if not pd.isna(row['RVOL']) else 1.0,
            'vsa_class': row.get('VSA_Class', 'Normal'),
            'weis_wave_dir': int(row.get('Weis_Wave_Dir', 1)),
            'weis_wave_vol': float(row.get('Weis_Wave_Vol', row['Volume'])),
            'creek': creek,
            'ice': ice,
            'mid': mid
        })

    return {
        'candles': candles,
        'markers': markers,
        'creek': creek,
        'ice': ice,
        'mid': mid
    }

def run_wyckoff_screener(symbols=None, force_refresh=False):
    """Scans symbol universe and caches results to JSON."""
    if symbols is None:
        symbols = CORE_UNIVERSE

    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            mtime = os.path.getmtime(CACHE_FILE)
            if time.time() - mtime < 1800:
                with open(CACHE_FILE, 'r') as f:
                    return json.load(f)
        except Exception:
            pass

    results = []
    spring_count = 0
    sos_count = 0
    lps_count = 0
    absorption_count = 0
    utad_count = 0
    sow_count = 0
    phase_a_count = 0
    phase_b_count = 0
    phase_c_count = 0
    phase_d_count = 0
    phase_e_count = 0
    total_acc = 0
    total_dist = 0

    print(f"[Wyckoff Engine] Scanning {len(symbols)} liquid tickers for Wyckoff setups...")
    for sym in symbols:
        try:
            df = get_stock_data(sym, lookback_days=260)
            if df is None or len(df) < 30:
                continue
            res = detect_wyckoff_setups(sym, df)
            if not res:
                continue
                
            setup_key = res['primary_setup']['setup_key']
            ph_letter = res.get('phase_letter', 'B')
            
            if ph_letter == 'A':
                phase_a_count += 1
                total_acc += 1
            elif ph_letter == 'C':
                phase_c_count += 1
                if setup_key == 'utad':
                    total_dist += 1
                else:
                    total_acc += 1
            elif ph_letter == 'D':
                phase_d_count += 1
                if setup_key == 'sow':
                    total_dist += 1
                else:
                    total_acc += 1
            elif ph_letter == 'E':
                phase_e_count += 1
                total_acc += 1
            else:
                phase_b_count += 1
                if res['wyckoff_score'] >= 55:
                    total_acc += 1
                else:
                    total_dist += 1

            if setup_key == 'spring':
                spring_count += 1
            elif setup_key in ['phase_c_lps', 'lps']:
                lps_count += 1
            elif setup_key == 'sos':
                sos_count += 1
            elif setup_key == 'absorption':
                absorption_count += 1
            elif setup_key == 'utad':
                utad_count += 1
            elif setup_key == 'sow':
                sow_count += 1

            results.append(res)
        except Exception:
            continue

    results.sort(key=lambda x: x['wyckoff_score'], reverse=True)
    total_scanned = len(results)
    acc_ratio = round((total_acc / total_scanned) * 100.0, 1) if total_scanned > 0 else 50.0
    dist_ratio = round((total_dist / total_scanned) * 100.0, 1) if total_scanned > 0 else 50.0
    
    if acc_ratio >= 65:
        posture = "Institutional Accumulation Dominant (Strong Markup Posture)"
        posture_badge = "BULLISH_ACCUMULATION"
    elif dist_ratio >= 60:
        posture = "Institutional Distribution Dominant (Defensive / Markdown Posture)"
        posture_badge = "BEARISH_DISTRIBUTION"
    else:
        posture = "Equilibrium / Selective Accumulation"
        posture_badge = "SELECTIVE_EQUILIBRIUM"

    payload = {
        'last_updated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_scanned': total_scanned,
        'market_posture': {
            'text': posture,
            'badge': posture_badge,
            'accumulation_pct': acc_ratio,
            'distribution_pct': dist_ratio,
            'spring_count': spring_count,
            'sos_count': sos_count,
            'lps_count': lps_count,
            'absorption_count': absorption_count,
            'utad_count': utad_count,
            'sow_count': sow_count,
            'phase_a_count': phase_a_count,
            'phase_b_count': phase_b_count,
            'phase_c_count': phase_c_count,
            'phase_d_count': phase_d_count,
            'phase_e_count': phase_e_count
        },
        'stocks': results
    }

    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(CACHE_FILE, 'w') as f:
            json.dump(payload, f, indent=2)
    except Exception as e:
        print(f"[Wyckoff Engine] Cache save warning: {e}")

    return payload

def get_detailed_stock_wyckoff(ticker, lookback_bars=260):
    """Returns deep analysis, multi-timeframe chart candles (up to 1-year), Creek/Ice lines, markers, and trade plan for a single stock."""
    df = get_stock_data(ticker, lookback_days=320)
    if df is None or len(df) < 25:
        return {'error': f"Insufficient historical price data found for {ticker}."}

    df = calculate_vsa_indicators(df)
    setup_result = detect_wyckoff_setups(ticker, df)
    if not setup_result:
        return {'error': f"Could not construct Wyckoff trading range for {ticker}."}

    chart_data = generate_annotated_chart_data(df, setup_result, limit_bars=lookback_bars)
    tr = setup_result['trading_range']
    primary = setup_result.get('primary_setup', {})
    direction = primary.get('direction', 'BULLISH')

    phase_progression = compute_wyckoff_phase_progression(
        setup_result['wyckoff_phase'],
        setup_result['primary_setup']['setup_key'],
        tr['cause_bars'],
        setup_result['current_price'],
        tr['creek'],
        tr['ice'],
        phase_letter=setup_result.get('phase_letter'),
        direction=direction
    )

    phase_let = setup_result.get('phase_letter', 'C')
    effect_type = tr.get('effect_type', 'MARKDOWN' if direction == 'BEARISH' else ('CONDITIONAL_PHASE_B' if phase_let == 'B' else 'MARKUP'))

    if effect_type == 'MARKDOWN':
        proj_target = tr.get('pf_down_t2', tr['pf_target'])
        proj_gain = tr.get('pf_down_gain_t2', tr['pf_gain_pct'])
        active_multi_tier = tr.get('multi_tier_downside_targets', tr.get('multi_tier_targets'))
    else:
        proj_target = tr['pf_target']
        proj_gain = tr['pf_gain_pct']
        active_multi_tier = tr['multi_tier_targets']

    return {
        'ticker': ticker.upper(),
        'setup_result': setup_result,
        'chart_data': chart_data,
        'phase_progression': phase_progression,
        'weis_wave': tr.get('weis_wave', {}),
        'cause_and_effect': {
            'cause_duration_bars': tr['cause_bars'],
            'cause_duration_days': tr['cause_days'],
            'cause_start_date': tr['cause_start_date'],
            'tr_height_dollars': tr['tr_height'],
            'tr_height_pct': tr['tr_height_pct'],
            'effect_type': effect_type,
            'upper_collar_name': tr.get('upper_collar_name', 'The Creek'),
            'lower_collar_name': tr.get('lower_collar_name', 'The Ice'),
            'projected_target': proj_target,
            'projected_markup_target': proj_target,
            'projected_gain_pct': proj_gain,
            'box_size': tr.get('box_size', 1.0),
            'multi_tier_targets': active_multi_tier,
            'multi_tier_downside_targets': tr.get('multi_tier_downside_targets', {}),
            'multi_tier_upside_targets': tr.get('multi_tier_targets', {}),
            'cause_potency': tr['cause_potency'],
            'cause_maturity': tr['cause_maturity'],
            'range_pos_pct': tr['range_pos_pct'],
            'up_down_vol_ratio': tr['up_down_vol_ratio'],
            'dist_to_creek_pct': tr['dist_to_creek_pct'],
            'dist_to_ice_pct': tr['dist_to_ice_pct'],
            'vdu_index': tr['vdu_index']
        }
    }

if __name__ == '__main__':
    print("Testing upgraded Wyckoff Engine locally...")
    test_symbols = ["NVDA", "AAPL", "TSLA", "AMD", "COIN", "AVGO"]
    summary = run_wyckoff_screener(symbols=test_symbols, force_refresh=True)
    print(f"Scanned {summary['total_scanned']} stocks.")
    for s in summary['stocks']:
        tr = s['trading_range']
        print(f"{s['ticker']:5s} | Setup: {s['primary_setup']['name']:25s} | Base: {tr['cause_bars']:2d} bars ({tr['cause_days']:3d}d) | P&F Target: ${tr['pf_target']:.2f} (+{tr['pf_gain_pct']}%)")
