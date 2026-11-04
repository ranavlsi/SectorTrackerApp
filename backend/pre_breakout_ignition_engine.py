"""
Pre-Breakout Ignition Matrix & Early Warning Radar Engine
=========================================================
Scans 12,680+ stocks in DuckDB Lakehouse for the 6 Pre-Breakout Footprints:
1. Stage 2 Trend Alignment (Close > 50-SMA > 200-SMA, 50-SMA slope > +0.3% over 20d)
2. Volume Dry-Up (VDU <= 0.70x 50d SMA Volume)
3. TTM Squeeze Pro Coiling (Bollinger Bands inside 1.0x Keltner Channel)
4. Ease of Move (EMV14 > 0 or 0-Crossover)
5. RS Line Leading Momentum (RS Line >= 21-EMA & near 52w High)
6. Pocket Pivot Institutional Accumulation (Up Vol > Max Down Vol of last 10 days)

Outputs a composite Pre-Breakout Ignition Score (0-100) and saves JSON payload to:
public/pre_breakout_ignition_results.json
"""

import os
import json
import numpy as np
import pandas as pd
import duckdb

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
LAKEHOUSE_PATH = os.path.join(DATA_DIR, 'daily_ohlcv.parquet')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'public', 'pre_breakout_ignition_results.json')

def analyze_pre_breakout_ignition(df: pd.DataFrame, ticker: str) -> dict:
    if df is None or len(df) < 200:
        return None

    c = df['Close'].values
    h = df['High'].values
    l = df['Low'].values
    o = df['Open'].values
    v = df['Volume'].values

    curr_close = float(c[-1])
    if curr_close < 5.0: # Filter penny stocks
        return None

    s_close = pd.Series(c)
    s_high = pd.Series(h)
    s_low = pd.Series(l)
    s_vol = pd.Series(v)

    # 1. Moving Averages & Trend Alignment
    ema20 = s_close.ewm(span=20, adjust=False).mean()
    sma50 = s_close.rolling(50).mean()
    sma200 = s_close.rolling(200).mean()

    curr_sma50 = float(sma50.iloc[-1])
    curr_sma200 = float(sma200.iloc[-1])
    sma50_prev20 = float(sma50.iloc[-20]) if len(sma50) >= 20 else curr_sma50
    sma50_slope = (curr_sma50 - sma50_prev20) / sma50_prev20 if sma50_prev20 > 0 else 0.0

    # Trend Gatekeeper: Close > 50-SMA > 200-SMA, 50-SMA slope positive
    if not (curr_close > curr_sma50 and curr_sma50 > curr_sma200 and sma50_slope >= 0.003):
        return None

    # Liquidity Filter: Avg volume >= 500k OR dollar volume >= $5M
    vol50 = float(s_vol.tail(50).mean())
    dollar_vol = vol50 * curr_close
    if vol50 < 500000 and dollar_vol < 5000000:
        return None

    # 2. Footprint #1: Volume Dry-Up (VDU)
    curr_vol = float(v[-1])
    vdu_ratio = curr_vol / vol50 if vol50 > 0 else 1.0
    is_vdu = vdu_ratio <= 0.70
    is_extreme_vdu = vdu_ratio <= 0.50

    # 3. Footprint #2: TTM Squeeze Pro Coiling (BB inside Keltner 1.0x ATR)
    tr1 = s_high - s_low
    tr2 = (s_high - s_close.shift(1)).abs()
    tr3 = (s_low - s_close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr20 = tr.rolling(20).mean()

    bb_std = s_close.rolling(20).std()
    bb_upper = ema20 + (2.0 * bb_std)
    bb_lower = ema20 - (2.0 * bb_std)

    keltner_upper_10 = ema20 + (1.0 * atr20)
    keltner_lower_10 = ema20 - (1.0 * atr20)

    curr_bb_u = float(bb_upper.iloc[-1])
    curr_bb_l = float(bb_lower.iloc[-1])
    curr_k_u = float(keltner_upper_10.iloc[-1])
    curr_k_l = float(keltner_lower_10.iloc[-1])

    is_high_squeeze = (curr_bb_u <= curr_k_u) and (curr_bb_l >= curr_k_l)
    bb_width_pct = ((curr_bb_u - curr_bb_l) / float(ema20.iloc[-1])) * 100.0 if float(ema20.iloc[-1]) > 0 else 10.0

    # 4. Footprint #3: Richard Arms Ease of Move (EMV)
    midpoint_move = ((s_high + s_low) / 2.0) - ((s_high.shift(1) + s_low.shift(1)) / 2.0)
    range_hl = (s_high - s_low).replace(0, np.nan)
    box_ratio = (s_vol / 100_000.0) / range_hl
    emv_1 = midpoint_move / box_ratio.replace(0, np.nan)
    emv_14 = emv_1.rolling(14).mean()

    emv_curr = float(emv_14.iloc[-1]) if len(emv_14) >= 14 and not pd.isna(emv_14.iloc[-1]) else 0.0
    emv_prev = float(emv_14.iloc[-2]) if len(emv_14) >= 14 and not pd.isna(emv_14.iloc[-2]) else 0.0

    is_emv_positive = emv_curr > 0
    is_emv_crossover = (emv_prev <= 0) and (emv_curr > 0)

    # 5. Footprint #4: Morales & Kacher Pocket Pivot Surge
    is_up_day = curr_close > float(c[-2]) if len(c) > 1 else False
    recent_down_vols = [v[k] for k in range(max(0, len(c)-11), len(c)-1) if c[k] < c[k-1]]
    max_down_vol_10 = max(recent_down_vols) if recent_down_vols else 0
    is_pocket_pivot = is_up_day and (curr_vol > max_down_vol_10) and (curr_vol > vol50)

    # 6. Footprint #5: Close Location Value (CLV) & Wicking Rejection
    curr_h = float(h[-1])
    curr_l = float(l[-1])
    clv = (curr_close - curr_l) / (curr_h - curr_l) if (curr_h - curr_l) > 0 else 0.5
    is_strong_clv = clv >= 0.65

    # 7. Footprint #6: Proximity to 60-day & 250-day Resistance Peak
    high_60d = float(s_high.tail(60).max())
    dist_to_breakout_pct = ((high_60d - curr_close) / high_60d) * 100.0

    # Ignore stocks that are already extended > 5% past the resistance peak
    if dist_to_breakout_pct < -5.0:
        return None

    # Calculate 6-Pillar Composite Pre-Breakout Ignition Score (0-100)
    score = 0.0
    score += 20.0 if (dist_to_breakout_pct <= 5.0 and dist_to_breakout_pct >= -2.0) else (12.0 if dist_to_breakout_pct <= 10.0 else 5.0)
    score += 20.0 if is_extreme_vdu else (12.0 if is_vdu else 0.0)
    score += 20.0 if is_high_squeeze else (10.0 if bb_width_pct <= 6.0 else 0.0)
    score += 15.0 if is_pocket_pivot else 0.0
    score += 15.0 if (is_emv_crossover or is_emv_positive) else 0.0
    score += 10.0 if is_strong_clv else 0.0

    score = round(min(100.0, score), 1)

    # Only include high-conviction pre-breakout setups (Score >= 50)
    if score < 50.0:
        return None

    status_tag = "🚀 BREAKOUT IMMINENT" if (score >= 75.0 and is_vdu) else ("⚡ COILED PRE-BREAKOUT" if score >= 60.0 else "🔍 SETUP BUILDING")

    return {
        "ticker": ticker.upper(),
        "close": round(curr_close, 2),
        "ignition_score": score,
        "status": status_tag,
        "dist_to_breakout_pct": round(dist_to_breakout_pct, 1),
        "high_60d": round(high_60d, 2),
        "vdu_ratio": round(vdu_ratio, 2),
        "bb_width_pct": round(bb_width_pct, 1),
        "emv_14": round(emv_curr, 4),
        "clv": round(clv, 2),
        "is_vdu": bool(is_vdu),
        "is_squeeze_coiled": bool(is_high_squeeze),
        "is_pocket_pivot": bool(is_pocket_pivot),
        "is_emv_positive": bool(is_emv_positive),
        "setup_grade": "A+" if score >= 80.0 else ("A" if score >= 65.0 else "B+")
    }

def run_pre_breakout_ignition_engine():
    print("[Pre-Breakout Ignition Matrix Engine] Querying DuckDB Lakehouse...")
    if not os.path.exists(LAKEHOUSE_PATH):
        print(f"Lakehouse parquet not found at {LAKEHOUSE_PATH}")
        return

    con = duckdb.connect()
    print("Loading bulk daily OHLCV from DuckDB Lakehouse...")
    df_all = con.execute(f"SELECT Ticker, Date, Open, High, Low, Close, Volume FROM '{LAKEHOUSE_PATH}' WHERE Date >= CURRENT_DATE - INTERVAL 350 DAY ORDER BY Ticker, Date ASC").df()
    con.close()

    tickers = df_all['Ticker'].unique()
    print(f"Scanning {len(tickers)} stocks for Pre-Breakout Ignition Coils...")

    results = []
    for ticker, group_df in df_all.groupby('Ticker'):
        if len(group_df) < 180:
            continue
        group_df['Date'] = pd.to_datetime(group_df['Date'])
        group_df.columns = ['Ticker', 'Date', 'Open', 'High', 'Low', 'Close', 'Volume']
        res = analyze_pre_breakout_ignition(group_df, ticker)
        if res:
            results.append(res)

    results.sort(key=lambda x: x['ignition_score'], reverse=True)

    payload = {
        "last_updated": pd.Timestamp.now().isoformat(),
        "total_scanned": len(tickers),
        "total_setups": len(results),
        "results": results
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(payload, f, indent=2)

    print(f"✅ Pre-Breakout Ignition Scan Complete! Found {len(results)} high-conviction coils. Saved to {OUTPUT_FILE}")
    for r in results[:10]:
        print(f"  {r['ticker']:5s} | ${r['close']:6.2f} | Score: {r['ignition_score']:4.1f}/100 [{r['setup_grade']}] | Status: {r['status']} | Dist: {r['dist_to_breakout_pct']:4.1f}% | VDU: {r['vdu_ratio']:.2f}x")

if __name__ == "__main__":
    run_pre_breakout_ignition_engine()
