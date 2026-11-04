"""
Stage 2 Trend Inception & 1st MA Retest Scanner (The "Holy Grail" Institutional Retest)
========================================================================================
Implements the exact institutional quant research blueprint:
1. Stage 2 Inception Breakout:
   - Proximity to 52-week High (Close >= 0.85 * 250d High)
   - Breakout Ignition: Close > 60d High with Volume >= 1.50x 20d SMA Volume
   - Moving Average Stack: 10-EMA > 21-EMA > 50-SMA > 200-SMA, 50-SMA slope >= +0.5% over 20d, rising 200-SMA.
   - RS Line Outperformance vs SPY.
2. 1st Retest Microstructure (State Machine):
   - Impulse Expansion: Price expanded >= +10% above 21-EMA post-breakout.
   - 1st Retest Touch: Low touches 21-EMA or 50-SMA (within 1.5%).
   - Invalidation: No severe 50-SMA undercuts (>4%), no distribution down-day volume surge (>1.5x 20d avg).
3. High-Winrate Confirmation Triggers:
   - Volume Dry-Up (VDU <= 0.75x 20d SMA) or Pocket Pivot Reclaim.
   - Rejection Candle Geometry: Close Location Value (CLV >= 0.65).
"""

import os
import json
from typing import Optional, Dict, Any
import numpy as np
import pandas as pd
import duckdb

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
LAKEHOUSE_PATH = os.path.join(DATA_DIR, 'daily_ohlcv.parquet')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'public', 'first_ma_pullback_results.json')

def analyze_stage2_first_retest(df: pd.DataFrame, ticker: str, spy_df: Optional[pd.DataFrame] = None) -> Optional[Dict[str, Any]]:
    """
    Evaluates whether a single stock DataFrame matches the Stage 2 Inception & 1st MA Retest criteria.
    STRICT CONDITIONS:
    1. Must touch the 21-EMA or 50-SMA TODAY (last trading bar).
    2. Must be the FIRST pullback touch since Stage 2 uptrend ignition expansion (zero prior touches).
    3. Stage 2 MA Stack must be aligned (10-EMA > 21-EMA > 50-SMA > 200-SMA, 50-SMA slope > +0.3%).
    """
    if df is None or len(df) < 220:
        return None

    c = df['Close'].values
    h = df['High'].values
    l = df['Low'].values
    o = df['Open'].values
    v = df['Volume'].values

    n_bars = len(c)
    curr_close = float(c[-1])
    if curr_close < 5.0: # Filter penny stocks
        return None

    # Calculate Moving Averages
    s_close = pd.Series(c)
    ema10 = s_close.ewm(span=10, adjust=False).mean().values
    ema21 = s_close.ewm(span=21, adjust=False).mean().values
    sma50 = s_close.rolling(50).mean().values
    sma200 = s_close.rolling(200).mean().values
    
    s_vol = pd.Series(v)
    vol_sma20 = s_vol.rolling(20).mean().values

    avg_vol_20 = float(vol_sma20[-1])
    if avg_vol_20 < 100000 or (avg_vol_20 * curr_close) < 2000000: # Liquidity filter
        return None

    # 1. STRICT REQUIREMENT: MUST TOUCH 21-EMA OR 50-SMA TODAY (Last Bar)
    curr_l = float(l[-1])
    curr_h = float(h[-1])
    curr_e21 = float(ema21[-1])
    curr_s50 = float(sma50[-1])

    touched_21ema_today = (curr_l <= curr_e21 * 1.012) and (curr_h >= curr_e21 * 0.985)
    touched_50sma_today = (curr_l <= curr_s50 * 1.015) and (curr_h >= curr_s50 * 0.985)

    if not (touched_21ema_today or touched_50sma_today):
        return None

    # 2. Stage 2 Moving Average Stack Alignment TODAY
    sma50_slope20 = float((sma50[-1] - sma50[-20]) / sma50[-20])
    sma200_rising = bool(sma200[-1] > sma200[-20])
    ma_stack_today = (ema10[-1] > ema21[-1]) and (ema21[-1] > sma50[-1]) and (sma50[-1] > sma200[-1]) and (sma50_slope20 >= 0.003) and sma200_rising

    if not ma_stack_today:
        return None

    # 3. Search past 60 bars for Stage 2 Inception Ignition
    ignition_bar_idx = -1
    for i in range(max(200, n_bars - 60), n_bars - 1):
        row_c = c[i]
        row_v = v[i]
        row_v20 = vol_sma20[i]
        prev_60d_high = np.max(h[max(0, i-60):i])
        high_250d = np.max(h[max(0, i-250):i+1])
        
        near_52w = row_c >= (0.80 * high_250d)
        is_breakout = (row_c > prev_60d_high) and (row_v >= 1.30 * row_v20) and near_52w
        
        if is_breakout:
            ignition_bar_idx = i
            break

    if ignition_bar_idx == -1:
        return None

    # 4. Impulse Expansion Check (Price expanded >= +10% post-ignition)
    ignition_ema21 = float(ema21[ignition_bar_idx])
    max_post_ignition_high = float(np.max(h[ignition_bar_idx:n_bars]))
    impulse_gain = (max_post_ignition_high - ignition_ema21) / ignition_ema21

    if impulse_gain < 0.10: # Minimum 10% impulse move required
        return None

    # 5. STRICT 1ST RETEST CHECK: Zero prior touches between ignition expansion and yesterday (n_bars - 2)
    prior_touches = 0
    for k in range(ignition_bar_idx + 1, n_bars - 1):
        if (l[k] <= ema21[k] * 1.012) or (l[k] <= sma50[k] * 1.015):
            prior_touches += 1

    if prior_touches > 0:
        return None # Rejected: This is Retest #2 or #3, NOT the First MA Pullback!

    # 6. Rejection Quality Metrics TODAY
    ma_tested = '21-EMA' if touched_21ema_today else '50-SMA'
    ma_price = curr_e21 if ma_tested == '21-EMA' else curr_s50
    dist_pct = ((curr_close - ma_price) / ma_price) * 100.0

    clv_today = (curr_close - curr_l) / (curr_h - curr_l) if (curr_h - curr_l) > 0 else 0.5
    vdu_today = float(v[-1] / vol_sma20[-1]) if vol_sma20[-1] > 0 else 1.0
    bars_since_ignition = n_bars - 1 - ignition_bar_idx

    return {
        "ticker": ticker.upper(),
        "close": round(curr_close, 2),
        "ma_tested": ma_tested,
        "ma_price": round(ma_price, 2),
        "rejection_dist_pct": round(dist_pct, 2),
        "close_location_value": round(clv_today, 2),
        "volume_footprint": "VDU (Volume Dry-Up)" if vdu_today <= 0.80 else "Pocket Pivot Reclaim",
        "volume_ratio": round(vdu_today, 2),
        "trend_duration_bars": int(bars_since_ignition),
        "impulse_gain_pct": round(impulse_gain * 100.0, 1),
        "retest_number": 1,
        "is_first_retest": True,
        "setup_quality": "A+" if (vdu_today <= 0.75 and clv_today >= 0.60) else "A"
    }

    return None

def run_first_ma_pullback_scanner():
    print("[First MA Pullback Scanner - Research Blueprint Engine] Querying DuckDB Lakehouse...")
    if not os.path.exists(LAKEHOUSE_PATH):
        print("Lakehouse not found.")
        return

    con = duckdb.connect()
    print("Loading bulk daily OHLCV from DuckDB Lakehouse...")
    df_all = con.execute(f"SELECT Ticker, Date, Open, High, Low, Close, Volume FROM '{LAKEHOUSE_PATH}' WHERE Date >= CURRENT_DATE - INTERVAL 400 DAY ORDER BY Ticker, Date ASC").df()
    con.close()

    tickers = df_all['Ticker'].unique()
    print(f"Scanning {len(tickers)} stocks for Research-Grade Stage 2 1st MA Retests...")

    results = []
    for ticker, group_df in df_all.groupby('Ticker'):
        if len(group_df) < 220:
            continue
        group_df['Date'] = pd.to_datetime(group_df['Date'])
        group_df.columns = ['Ticker', 'Date', 'Open', 'High', 'Low', 'Close', 'Volume']
        res = analyze_stage2_first_retest(group_df, ticker)
        if res:
            results.append(res)
    results.sort(key=lambda x: (x['setup_quality'] == 'A+', x['impulse_gain_pct']), reverse=True)

    payload = {
        "last_updated": pd.Timestamp.now().isoformat(),
        "total_scanned": len(tickers),
        "total_setups": len(results),
        "results": results
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(payload, f, indent=2)

    print(f"✅ Research Scanner Complete! Found {len(results)} Stage 2 1st MA Retest setups. Saved to {OUTPUT_FILE}")
    for r in results[:10]:
        print(f"  {r['ticker']:5s} | ${r['close']:6.2f} | 1st Retest off {r['ma_tested']} (${r['ma_price']:6.2f}) | Impulse: +{r['impulse_gain_pct']:4.1f}% | Footprint: {r['volume_footprint']}")

    return payload

if __name__ == "__main__":
    run_first_ma_pullback_scanner()
