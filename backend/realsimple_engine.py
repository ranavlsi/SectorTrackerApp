import os
import json
import time
import math
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

def analyze_realsimple_stock(ticker: str, spy_df: pd.DataFrame):
    """Evaluates a ticker against Ariel Hernandez's Real Simple Framework."""
    try:
        t = yf.Ticker(ticker)
        df = t.history(period="1y")
        if df.empty or len(df) < 150:
            return None

        close = df['Close']
        high = df['High']
        low = df['Low']
        volume = df['Volume']

        # 1. Structural Moving Averages
        ema9 = close.ewm(span=9, adjust=False).mean()
        ema21 = close.ewm(span=21, adjust=False).mean()
        sma50 = close.rolling(50).mean()

        c_val = float(close.iloc[-1])
        e9_val = float(ema9.iloc[-1])
        e21_val = float(ema21.iloc[-1])
        s50_val = float(sma50.iloc[-1])

        # 2. Structure Check
        is_aligned = (c_val > e9_val > e21_val > s50_val)
        is_above_21 = c_val > e21_val

        # 3. RS Line vs SPY Outperformance
        rs_outperformance = 0.0
        if not spy_df.empty and len(spy_df) >= 60 and len(df) >= 60:
            stock_60d = (c_val - close.iloc[-60]) / close.iloc[-60]
            spy_c = float(spy_df['Close'].iloc[-1])
            spy_60d_c = float(spy_df['Close'].iloc[-60])
            spy_60d = (spy_c - spy_60d_c) / spy_60d_c
            rs_outperformance = float((stock_60d - spy_60d) * 100)

        # 4. Volatility Contraction (VCP) & Volume Dry-Up (VDU)
        high_20 = float(high.iloc[-20:].max())
        low_20 = float(low.iloc[-20:].min())
        base_depth_pct = float((high_20 - low_20) / high_20 * 100)

        avg_vol_20 = float(volume.iloc[-21:-1].mean())
        curr_vol = float(volume.iloc[-1])
        vdu_ratio = float(curr_vol / max(avg_vol_20, 1))

        # 5. Execution Triggers
        is_9ema_touch = (low.iloc[-1] <= e9_val * 1.005 and c_val >= e9_val)
        is_21ema_touch = (low.iloc[-1] <= e21_val * 1.005 and c_val >= e21_val)
        is_breakout = (c_val >= high_20 * 0.995 and vdu_ratio >= 1.2)

        setup_type = "WATCH"
        exposure_action = "OBSERVE"

        if is_breakout and is_aligned and rs_outperformance > 5.0:
            setup_type = "🚀 9-EMA MOMENTUM BREAKOUT"
            exposure_action = "TIER 1 PILOT ENTRY (25%)"
        elif (is_9ema_touch or is_21ema_touch) and is_above_21 and vdu_ratio <= 0.8:
            setup_type = "🛡️ 21-EMA RETEST PIVOT (VDU)"
            exposure_action = "TIER 1 PILOT / RETEST ADD"
        elif is_aligned:
            setup_type = "📈 BULLISH 3-LINE ALIGNMENT"
            exposure_action = "HOLD FULL (TRAILING 9-EMA)"

        score = 0
        if is_aligned: score += 30
        if rs_outperformance > 10.0: score += 30
        elif rs_outperformance > 0.0: score += 15
        if base_depth_pct <= 15.0: score += 20
        if vdu_ratio <= 0.7: score += 20

        return {
            "ticker": ticker,
            "score": score,
            "price": round(c_val, 2),
            "ema9": round(e9_val, 2),
            "ema21": round(e21_val, 2),
            "sma50": round(s50_val, 2),
            "rs_outperformance_pct": round(rs_outperformance, 1),
            "vdu_ratio": round(vdu_ratio, 2),
            "base_depth_pct": round(base_depth_pct, 1),
            "setup_type": setup_type,
            "exposure_action": exposure_action
        }
    except Exception:
        return None

def run_realsimple_scanner():
    """Scans liquid leaders using Ariel Hernandez's Real Simple Framework."""
    tickers = ["NVDA", "PLTR", "HOOD", "MU", "AMD", "TSLA", "AAPL", "MSFT", "AMZN", "META", 
               "AVGO", "SMCI", "COIN", "APP", "CELH", "IONQ", "DELL", "ORCL", "NFLX", "UBER"]
    
    results = []
    try:
        spy_df = yf.Ticker("SPY").history(period="1y")
    except Exception:
        spy_df = pd.DataFrame()

    for ticker in tickers:
        res = analyze_realsimple_stock(ticker, spy_df)
        if res:
            results.append(res)

    results.sort(key=lambda x: x['score'], reverse=True)
    out = {"updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "stocks": results}
    
    public_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'realsimple_results.json')
    try:
        with open(public_path, 'w') as f:
            json.dump(out, f, indent=2)
    except Exception:
        pass

    return out

if __name__ == "__main__":
    res = run_realsimple_scanner()
    print(f"Real Simple Scanner scanned {len(res['stocks'])} stocks. Top Stock: {res['stocks'][0] if res['stocks'] else 'None'}")
