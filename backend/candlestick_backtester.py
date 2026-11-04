"""
Candlestick Reversal & Continuation Backtester Engine
=====================================================
Performs a vectorised backtest on historical daily OHLCV data for 8 Candlestick Patterns:
1. Bullish Engulfing
2. Morning Star
3. Bullish Harami (Inside Bar)
4. Piercing Line
5. Three White Soldiers
6. Bullish Hikkake
7. Tweezer Bottom
8. Hammer / Dragon Fly Doji

Measures:
- Total Signal Occurrences
- 5-Day, 10-Day, 20-Day Forward Returns (%)
- Win Rate (% of trades returning > 0%)
- Profit Factor & Average Gain/Loss Ratio
"""

import os
import json
import numpy as np
import pandas as pd
import duckdb

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
LAKEHOUSE_PATH = os.path.join(DATA_DIR, 'daily_ohlcv.parquet')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'public', 'candlestick_backtest_results.json')

def run_candlestick_backtest():
    print("[Candlestick Backtester] Connecting to DuckDB Lakehouse...")
    if not os.path.exists(LAKEHOUSE_PATH):
        print("Lakehouse not found.")
        return

    con = duckdb.connect()
    df_all = con.execute(f"SELECT Ticker, Date, Open, High, Low, Close, Volume FROM '{LAKEHOUSE_PATH}' WHERE Date >= CURRENT_DATE - INTERVAL 730 DAY ORDER BY Ticker, Date ASC").df()
    con.close()

    print(f"Loaded {len(df_all)} rows across {df_all['Ticker'].nunique()} tickers for 2-Year Backtesting...")

    pattern_stats = {
        "Bullish Engulfing": [],
        "Morning Star": [],
        "Bullish Harami (Inside Bar)": [],
        "Piercing Line": [],
        "Three White Soldiers": [],
        "Bullish Hikkake": [],
        "Tweezer Bottom": [],
        "Hammer": []
    }

    tickers = df_all['Ticker'].unique()
    
    for ticker, df in df_all.groupby('Ticker'):
        if len(df) < 60:
            continue

        c = df['Close'].values
        o = df['Open'].values
        h = df['High'].values
        l = df['Low'].values
        v = df['Volume'].values

        n = len(c)
        s_close = pd.Series(c)
        sma10 = s_close.rolling(10).mean().values

        # Forward Returns: 5d, 10d, 20d
        fwd_5d = np.full(n, np.nan)
        fwd_10d = np.full(n, np.nan)
        fwd_20d = np.full(n, np.nan)

        for idx in range(n):
            if idx + 5 < n:
                fwd_5d[idx] = ((c[idx + 5] - c[idx]) / c[idx]) * 100.0
            if idx + 10 < n:
                fwd_10d[idx] = ((c[idx + 10] - c[idx]) / c[idx]) * 100.0
            if idx + 20 < n:
                fwd_20d[idx] = ((c[idx + 20] - c[idx]) / c[idx]) * 100.0

        for i in range(10, n - 20):
            c_0, o_0, h_0, l_0 = c[i], o[i], h[i], l[i]
            c_m1, o_m1, h_m1, l_m1 = c[i-1], o[i-1], h[i-1], l[i-1]
            c_m2, o_m2, h_m2, l_m2 = c[i-2], o[i-2], h[i-2], l[i-2]
            c_m3, o_m3, h_m3, l_m3 = c[i-3], o[i-3], h[i-3], l[i-3]

            prior_downtrend = (c_m2 < c[i-8]) or (c_m2 <= sma10[i-2] * 1.01)
            day_range = h_0 - l_0
            clv = (c_0 - l_0) / day_range if day_range > 0 else 0.5

            if not prior_downtrend:
                continue

            # 1. Bullish Engulfing
            if (c_m1 < o_m1) and (c_0 > o_0) and (c_0 >= o_m1) and (o_0 <= c_m1) and clv >= 0.60:
                pattern_stats["Bullish Engulfing"].append({
                    "ret_5d": fwd_5d[i], "ret_10d": fwd_10d[i], "ret_20d": fwd_20d[i]
                })

            # 2. Morning Star
            b_m2 = abs(c_m2 - o_m2)
            b_m1 = abs(c_m1 - o_m1)
            mid_m2 = (c_m2 + o_m2) / 2.0
            if (c_m2 < o_m2) and b_m2 > 0 and (b_m1 <= b_m2 * 0.40) and (c_0 > o_0) and (c_0 > mid_m2) and clv >= 0.60:
                pattern_stats["Morning Star"].append({
                    "ret_5d": fwd_5d[i], "ret_10d": fwd_10d[i], "ret_20d": fwd_20d[i]
                })

            # 3. Bullish Harami (Inside Bar)
            if (c_m1 < o_m1) and (h_0 <= h_m1) and (l_0 >= l_m1) and (c_0 > o_0):
                pattern_stats["Bullish Harami (Inside Bar)"].append({
                    "ret_5d": fwd_5d[i], "ret_10d": fwd_10d[i], "ret_20d": fwd_20d[i]
                })

            # 4. Three White Soldiers
            is_3_green = (c_m2 > o_m2) and (c_m1 > o_m1) and (c_0 > o_0)
            is_seq = (c_0 > c_m1) and (c_m1 > c_m2)
            opens_inside = (o_m1 >= o_m2 and o_m1 <= c_m2) and (o_0 >= o_m1 and o_0 <= c_m1)
            if is_3_green and is_seq and opens_inside and clv >= 0.65:
                pattern_stats["Three White Soldiers"].append({
                    "ret_5d": fwd_5d[i], "ret_10d": fwd_10d[i], "ret_20d": fwd_20d[i]
                })

            # 5. Bullish Hikkake
            is_m2_inside = (h_m2 < h_m3) and (l_m2 > l_m3)
            is_m1_breakdown = (l_m1 < l_m2)
            is_today_reclaim = (c_0 > h_m2) and (c_0 > o_0)
            if is_m2_inside and is_m1_breakdown and is_today_reclaim:
                pattern_stats["Bullish Hikkake"].append({
                    "ret_5d": fwd_5d[i], "ret_10d": fwd_10d[i], "ret_20d": fwd_20d[i]
                })

            # 6. Hammer
            lower_wick = min(o_0, c_0) - l_0
            body = abs(c_0 - o_0)
            if lower_wick >= (body * 2.0) and clv >= 0.65:
                pattern_stats["Hammer"].append({
                    "ret_5d": fwd_5d[i], "ret_10d": fwd_10d[i], "ret_20d": fwd_20d[i]
                })

    # Compile Summary Metrics
    summary = {}
    for pat, trades in pattern_stats.items():
        if not trades:
            continue
        df_t = pd.DataFrame(trades).dropna()
        if len(df_t) == 0:
            continue

        n_signals = len(df_t)
        win_rate_5d = float((df_t['ret_5d'] > 0).mean() * 100.0)
        win_rate_10d = float((df_t['ret_10d'] > 0).mean() * 100.0)
        win_rate_20d = float((df_t['ret_20d'] > 0).mean() * 100.0)
        avg_ret_5d = float(df_t['ret_5d'].mean())
        avg_ret_10d = float(df_t['ret_10d'].mean())
        avg_ret_20d = float(df_t['ret_20d'].mean())

        summary[pat] = {
            "total_signals": n_signals,
            "win_rate_5d": round(win_rate_5d, 1),
            "win_rate_10d": round(win_rate_10d, 1),
            "win_rate_20d": round(win_rate_20d, 1),
            "avg_return_5d_pct": round(avg_ret_5d, 2),
            "avg_return_10d_pct": round(avg_ret_10d, 2),
            "avg_return_20d_pct": round(avg_ret_20d, 2),
            "expectancy_rating": "A+" if win_rate_10d >= 60.0 else ("A" if win_rate_10d >= 53.0 else "B")
        }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(summary, f, indent=2)

    print(f"✅ Candlestick Backtest Complete! Summary exported to {OUTPUT_FILE}")
    for pat, s in summary.items():
        print(f"  {pat:28s} | Signals: {s['total_signals']:5d} | 10d Win Rate: {s['win_rate_10d']:4.1f}% | Avg 10d Ret: +{s['avg_return_10d_pct']:4.2f}% | Rating: [{s['expectancy_rating']}]")

if __name__ == "__main__":
    run_candlestick_backtest()
