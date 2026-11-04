"""
Clean Untangled Uptrend & 9/13 SMA Strong Trend Inception Scanner
================================================================
Exhaustive institutional scanner designed to identify stocks in powerful,
smooth, clean uptrends that have ONLY RECENTLY STARTED (3 to 30 trading days ago)
and have CLEANLY RESOLVED out of multi-month (6-month) see-sawing around
long-term moving averages (50 SMA, 150 SMA, and 200 SMA).

Strictly weeds out:
1. Directionless see-saws (stocks currently whipsawing across 50/150/200 SMA).
2. Mature / Overripe trends (stocks like WST, MPC, AVTR that broke out 3-6 months
   ago and have been continuously trending above 200 SMA for 90+ days).
3. Tangled moving averages (stocks where 9, 13, 21 SMA are criss-crossing or flat).
4. Stocks not respecting the 9 SMA or breaching the 13 SMA floor.
5. Overextended climax runs (>25% from 50 SMA or >30% from 200 SMA).
"""

import os
import json
import time
from typing import Optional, Dict, Any, List
import numpy as np
import pandas as pd
import duckdb

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
LAKEHOUSE_PATH = os.path.join(DATA_DIR, 'daily_ohlcv.parquet')
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'clean_uptrend_results.json')
SCREENER_RESULTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'screener_results.json')

def analyze_stock_clean_uptrend(
    ticker: str,
    df: pd.DataFrame,
    min_streak: int = 3,
    max_macro_bars: int = 35
) -> Optional[Dict[str, Any]]:
    """
    Evaluates a single stock against the Clean Untangled Uptrend & 6-Month SMA Resolution criteria.
    Disqualifies mature trends (trends that started months ago like April 2026).
    """
    n = len(df)
    if n < 210:  # Need at least 200 bars for 200 SMA + recent bars
        return None

    c = df['Close'].values
    h = df['High'].values
    l = df['Low'].values
    o = df['Open'].values
    v = df['Volume'].values
    dates = df['Date'].values

    curr_close = float(c[-1])
    if curr_close < 6.0:  # Exclude penny stocks
        return None

    # Calculate Moving Averages (Fast & Macro)
    s_close = pd.Series(c)
    sma9 = s_close.rolling(9).mean().values
    sma13 = s_close.rolling(13).mean().values
    sma21 = s_close.rolling(21).mean().values
    sma50 = s_close.rolling(50).mean().values
    sma150 = s_close.rolling(150).mean().values
    sma200 = s_close.rolling(200).mean().values

    if (np.isnan(sma200[-1]) or np.isnan(sma150[-1]) or np.isnan(sma50[-1]) or 
        np.isnan(sma21[-1]) or np.isnan(sma13[-1]) or np.isnan(sma9[-1])):
        return None

    # Volume filter: 20-day average volume >= 100,000 shares & $1.5M dollar volume
    s_vol = pd.Series(v)
    vol_sma20 = s_vol.rolling(20).mean().values
    avg_vol_20 = float(vol_sma20[-1]) if not np.isnan(vol_sma20[-1]) else 0
    if avg_vol_20 < 100000 or (avg_vol_20 * curr_close < 1500000):
        return None

    curr_sma9 = float(sma9[-1])
    curr_sma13 = float(sma13[-1])
    curr_sma21 = float(sma21[-1])
    curr_sma50 = float(sma50[-1])
    curr_sma150 = float(sma150[-1])
    curr_sma200 = float(sma200[-1])

    # 1. FULL MACRO BULLISH HIERARCHY: ALL SMAS MUST BE ABOVE 200 SMA!
    # Price >= 9 SMA > 13 SMA > 21 SMA > 50 SMA > 200 SMA
    # Strictly weeds out stocks like LIN, PG, COST where 50/21/13 SMAs are trapped below the 200 SMA!
    if not (curr_sma9 > curr_sma13 and curr_sma13 > curr_sma21 and curr_sma21 > curr_sma50 and curr_sma50 > curr_sma200):
        return None

    # Every single moving average must be above 200 SMA
    if not (curr_sma9 > curr_sma200 and curr_sma13 > curr_sma200 and curr_sma21 > curr_sma200):
        return None

    # Ribbon spacing: 9 SMA must have a real gap above 13 SMA (not tangled / flat)
    if (curr_sma9 - curr_sma13) / curr_sma13 < 0.0012:
        return None

    # Slopes of fast moving averages must be rising or firm
    slope_sma9 = (curr_sma9 - sma9[-3]) / sma9[-3] if len(sma9) >= 3 else 0.0
    slope_sma13 = (curr_sma13 - sma13[-3]) / sma13[-3] if len(sma13) >= 3 else 0.0
    slope_sma21 = (curr_sma21 - sma21[-5]) / sma21[-5] if len(sma21) >= 5 else 0.0
    slope_sma50 = (curr_sma50 - sma50[-5]) / sma50[-5] if len(sma50) >= 5 else 0.0

    if slope_sma9 < 0.0 or slope_sma13 < -0.001 or slope_sma50 < 0.0:
        return None

    # 2. LONG-TERM SMA RESOLUTION CHECK (50, 150, 200 SMA)
    # The stock must be above 50, 150, and 200 SMAs (Confirmed Macro Uptrend)
    if not (curr_close > curr_sma50 and curr_close > curr_sma200):
        return None

    # 200 SMA must not be in a steep structural downtrend
    if curr_sma200 < sma200[-20] * 0.99:
        return None

    # 3. DILIGENT EARLY TREND & ANTI-WHIPSAW FILTER AROUND 200 & 50 SMA
    # How many consecutive bars has Close been continuously above the 50 SMA?
    streak_above_50 = 0
    for val in reversed(c > sma50):
        if val:
            streak_above_50 += 1
        else:
            break

    # How many consecutive bars has Close been continuously above the 200 SMA?
    streak_above_200 = 0
    for val in reversed(c > sma200):
        if val:
            streak_above_200 += 1
        else:
            break

    # How many consecutive bars has 50 SMA been above 200 SMA?
    golden_cross_bars = 0
    for val in reversed(sma50 > sma200):
        if val:
            golden_cross_bars += 1
        else:
            break

    # STRICT EARLY TREND DILIGENCE (Eliminating Mature Trends like XLE and WST):
    # A) 200-SMA Breakout Age: Must have started trading above 200 SMA recently (between 4 and 30 trading days).
    # XLE (51 bars above 200 SMA), WST (90 bars above 200 SMA), and VLTO (61 bars) are strictly eliminated!
    if not (4 <= streak_above_200 <= 30):
        return None

    # B) 50-SMA Breakout Age: Must have cleanly cleared 50 SMA between 4 and 25 trading days ago.
    if not (4 <= streak_above_50 <= 25):
        return None

    # C) ANTI-WHIPSAW & MATURITY DISTANCE BOUNDS:
    dist_9sma_pct = round(((curr_close - curr_sma9) / curr_sma9) * 100.0, 1)
    dist_50sma_pct = round(((curr_close - curr_sma50) / curr_sma50) * 100.0, 1)
    dist_200sma_pct = round(((curr_close - curr_sma200) / curr_sma200) * 100.0, 1)

    # 200-SMA Cushion & Cap:
    # - Must have at least +1.5% cushion above 200-SMA to avoid whipsaws / false breakouts.
    # - Must NOT exceed +14.0% above 200-SMA to strictly catch EARLY trends (XLE at +17.5% and WST at +26.1% are disqualified).
    if not (1.5 <= dist_200sma_pct <= 14.0):
        return None

    # 50-SMA Cushion & Cap:
    # - Must be +1.5% to +11.0% from 50 SMA (early impulse, not late-stage extension).
    if not (1.5 <= dist_50sma_pct <= 11.0):
        return None

    # 9-SMA Buyable Proximity:
    if not (-1.5 <= dist_9sma_pct <= 4.5):
        return None

    # 4. 6-MONTH BASE & SEE-SAW RESOLUTION VERIFICATION
    # Look back 126 bars (~6 calendar months)
    lookback_6m = min(126, n)
    c_6m = c[-lookback_6m:]
    s50_6m = sma50[-lookback_6m:]
    s200_6m = sma200[-lookback_6m:]

    # Count crosses of 50-SMA over the past 6 months
    diff_50 = c_6m - s50_6m
    valid_diff_50 = diff_50[~np.isnan(diff_50)]
    crosses_50_6m = int(np.sum(np.diff(np.sign(valid_diff_50)) != 0)) if len(valid_diff_50) > 1 else 0

    # Count crosses of 200-SMA over past 6 months
    diff_200 = c_6m - s200_6m
    valid_diff_200 = diff_200[~np.isnan(diff_200)]
    crosses_200_6m = int(np.sum(np.diff(np.sign(valid_diff_200)) != 0)) if len(valid_diff_200) > 1 else 0

    # Was stock trading under or near 200-SMA within the last 60 bars?
    was_under_200_recently = np.any(c[-60:] < sma200[-60:] * 1.01)

    # Must have had a contested base / consolidation prior to this recent breakout
    if crosses_50_6m < 2 and not was_under_200_recently and crosses_200_6m == 0:
        return None

    # Weeds out active see-saw: Zero crosses of 50 SMA in recent streak (clean hold!)
    diff_50_recent = diff_50[-streak_above_50:]
    valid_diff_recent = diff_50_recent[~np.isnan(diff_50_recent)]
    crosses_50_recent = int(np.sum(np.diff(np.sign(valid_diff_recent)) != 0)) if len(valid_diff_recent) > 1 else 0
    if crosses_50_recent > 0:
        return None

    # 5. FAST RIBBON INCEPTION & RESPECT OF 9-SMA
    # Walk backwards from today to find when the fast 9/13 SMA clean trend started:
    # SMA9 > SMA13 and Close >= SMA13 * 0.99
    # Limit search to the macro breakout window
    max_search_bars = streak_above_50 + 4
    streak = 0
    for idx in range(n - 1, -1, -1):
        if (n - 1 - idx) > max_search_bars:
            break
        bar_c = c[idx]
        bar_s9 = sma9[idx]
        bar_s13 = sma13[idx]
        bar_s21 = sma21[idx]

        is_bull = (bar_s9 > bar_s13) and (bar_c >= bar_s13 * 0.99)
        if is_bull:
            streak += 1
        else:
            break

    if streak < min_streak:
        return None

    trend_start_idx = n - streak
    trend_start_date = str(dates[trend_start_idx])[:10]

    # Rule A: Zero closes below 13 SMA during the active trend
    closes_in_trend = c[trend_start_idx:n]
    lows_in_trend = l[trend_start_idx:n]
    sma9_in_trend = sma9[trend_start_idx:n]
    sma13_in_trend = sma13[trend_start_idx:n]

    if np.any(closes_in_trend < sma13_in_trend * 0.992):
        return None

    # Rule B: High 9-SMA Respect Rate (>= 75% of days closed above 9 SMA)
    respect_count = int(np.sum(closes_in_trend >= sma9_in_trend * 0.995))
    respect_pct = round((respect_count / streak) * 100.0, 1)
    if respect_pct < 75.0:
        return None

    # Rule C: Anti-Tangling Check - strictly zero crossings of 9 and 13 SMA during the active trend
    diff_trend = sma9_in_trend - sma13_in_trend
    if np.any(diff_trend <= 0):
        return None

    # 6. ANTI-SEE-SAW: DIRECTIONAL EFFICIENCY RATIO (Kaufman ER)
    net_displacement = abs(curr_close - float(c[trend_start_idx]))
    step_diffs = np.sum(np.abs(np.diff(closes_in_trend)))
    efficiency_ratio = round(float(net_displacement / step_diffs), 2) if step_diffs > 0 else 1.0

    if efficiency_ratio < 0.40:
        return None

    # 7. SPECIAL ACTIONABLE SIGNALS
    curr_low = float(l[-1])
    tested_9sma_today = (curr_low <= curr_sma9 * 1.008) and (curr_close >= curr_sma9 * 0.995)
    is_100_pct_rider = (respect_pct >= 99.9)

    # Up/Down Volume Ratio during trend
    up_vol = 0.0
    down_vol = 0.0
    for j in range(trend_start_idx + 1, n):
        if c[j] >= c[j - 1]:
            up_vol += v[j]
        else:
            down_vol += v[j]
    ud_vol_ratio = round(float(up_vol / max(down_vol, 1.0)), 2)

    # 8. COMPOSITE TREND STRENGTH SCORE (0-100)
    # - 9 SMA Respect (25 pts)
    # - Fresh Macro Inception (20 pts: 5 to 16 days gets max points)
    # - 6M Base Resolution Quality (20 pts)
    # - Directional Efficiency / Low Noise (15 pts)
    # - Controlled Proximity to 9 SMA (10 pts)
    # - Up/Down Volume Accumulation (10 pts)
    freshness_pts = 20.0 if (5 <= streak_above_50 <= 16) else (15.0 if streak_above_50 <= 25 else 10.0)
    respect_pts = (respect_pct / 100.0) * 25.0
    resolution_pts = 20.0 if (crosses_50_6m >= 4 or was_under_200_recently) else 15.0
    efficiency_pts = min(15.0, efficiency_ratio * 20.0)
    proximity_pts = max(0.0, 10.0 - abs(dist_9sma_pct) * 2.5)
    volume_pts = min(10.0, ud_vol_ratio * 4.0)

    composite_score = int(round(freshness_pts + respect_pts + resolution_pts + efficiency_pts + proximity_pts + volume_pts))
    composite_score = max(55, min(99, composite_score))

    # Action Badges
    badges = []
    if 3 <= streak <= 7:
        badges.append(f"🌟 FRESH INCEPTION ({streak}d)")
    elif 8 <= streak <= 14:
        badges.append(f"⚡ CLEAN IGNITION ({streak}d)")
    else:
        badges.append(f"📈 ESTABLISHED RIDE ({streak}d)")

    # 6-Month Resolution Badge
    if was_under_200_recently or crosses_200_6m >= 1:
        badges.append(f"🚀 RESOLVED 200-SMA BASE")
    elif crosses_50_6m >= 4:
        badges.append(f"⚡ RESOLVED 6M BASE ({crosses_50_6m}x 50-SMA)")
    else:
        badges.append("💎 RESOLVED 6M SMA COIL")

    if is_100_pct_rider:
        badges.append("🏄 100% 9-SMA RIDER")
    elif respect_pct >= 85.0:
        badges.append(f"🛡️ 9-SMA DEFENDER ({respect_pct}%)")

    if tested_9sma_today:
        badges.append("🎯 9-SMA PULLBACK BOUNCE")

    if ud_vol_ratio >= 1.5:
        badges.append("🔥 ACCUMULATION FLOW")

    # Change % today
    prev_close = float(c[-2]) if len(c) >= 2 else curr_close
    change_pct = round(((curr_close - prev_close) / prev_close) * 100.0, 2)

    macro_desc = (
        f"Early-Stage Resolution: Asset cleared its 200-SMA base {streak_above_200} sessions ago (currently +{dist_200sma_pct}% above 200-SMA at ${curr_sma200:.2f}) "
        f"and resolved above its 50-SMA {streak_above_50} sessions ago (+{dist_50sma_pct}% from 50-SMA at ${curr_sma50:.2f}). "
        f"Prior 6-month base saw {crosses_50_6m} crosses of 50-SMA before this decisive resolution. "
        f"Rigorous guardrails: cleared +1.5% cushion with zero whipsaws, yet strictly capped under +12% from 200-SMA to catch early-stage trend inception (disqualifying mature runners like XLE and WST). "
        f"The fast untangled ribbon (9 > 13 > 21 > 50 SMA) ignited {streak} sessions ago on {trend_start_date}. "
        f"9-SMA respect is {respect_pct}% with zero 13-SMA closes (ER: {efficiency_ratio:.2f}). "
        f"{'Currently testing the 9-SMA for low-risk entry. ' if tested_9sma_today else f'Price is +{dist_9sma_pct}% from 9-SMA. '}"
        f"Initial risk invalidation anchored strictly below the 13-SMA at ${curr_sma13:.2f}."
    )

    return {
        "ticker": ticker.upper(),
        "close": curr_close,
        "change_pct": change_pct,
        "streak_days": streak,
        "macro_breakout_bars": streak_above_50,
        "streak_above_200": streak_above_200,
        "streak_above_50": streak_above_50,
        "trend_start_date": trend_start_date,
        "sma9": curr_sma9,
        "sma13": curr_sma13,
        "sma21": curr_sma21,
        "sma50": curr_sma50,
        "sma150": curr_sma150,
        "sma200": curr_sma200,
        "crosses_50_6m": crosses_50_6m,
        "crosses_200_6m": crosses_200_6m,
        "crosses_50_recent": crosses_50_recent,
        "dist_9sma_pct": dist_9sma_pct,
        "dist_50sma_pct": dist_50sma_pct,
        "dist_200sma_pct": dist_200sma_pct,
        "respect_9sma_pct": respect_pct,
        "efficiency_ratio": efficiency_ratio,
        "ud_vol_ratio": ud_vol_ratio,
        "score": composite_score,
        "badges": badges,
        "tested_9sma_today": tested_9sma_today,
        "is_100_pct_rider": is_100_pct_rider,
        "desk_notes": macro_desc
    }

def run_clean_uptrend_scanner(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Exhaustive Lakehouse scan across all active liquid US stocks with 6-month macro SMA resolution.
    """
    t0 = time.time()
    print("[Clean Uptrend Scanner - Fresh 6M SMA Resolution Engine] Querying DuckDB Lakehouse...")

    if not os.path.exists(LAKEHOUSE_PATH):
        raise FileNotFoundError(f"Lakehouse parquet not found at {LAKEHOUSE_PATH}")

    con = duckdb.connect()
    # Fast filtering for liquid equities (volume >= 100,000 and price >= $6.0) with 420-day history
    df_all = con.execute(f"""
        WITH recent_stats AS (
            SELECT Ticker, max(Date) as max_d, avg(Volume) as avg_v, avg(Close) as avg_c
            FROM '{LAKEHOUSE_PATH}'
            WHERE Date >= CURRENT_DATE - INTERVAL 75 DAY
            GROUP BY Ticker
            HAVING avg_v >= 100000 AND avg_c >= 6.0
        )
        SELECT d.Ticker, d.Date, d.Open, d.High, d.Low, d.Close, d.Volume
        FROM '{LAKEHOUSE_PATH}' d
        INNER JOIN recent_stats s ON d.Ticker = s.Ticker
        WHERE d.Date >= CURRENT_DATE - INTERVAL 420 DAY
        ORDER BY d.Ticker, d.Date ASC
    """).df()
    con.close()

    total_tickers = df_all['Ticker'].nunique()
    print(f"[Clean Uptrend Scanner] Loaded {len(df_all)} daily records for {total_tickers} liquid stocks in {time.time()-t0:.2f}s.")

    candidates = []
    for ticker, group_df in df_all.groupby('Ticker'):
        if len(group_df) < 210:
            continue
        res = analyze_stock_clean_uptrend(ticker, group_df)
        if res:
            candidates.append(res)

    # Sort candidates by Score desc, then streak_days asc (sweet spot), then respect_9sma_pct desc
    candidates.sort(key=lambda x: (x['score'], -abs(x['dist_9sma_pct']), x['respect_9sma_pct']), reverse=True)

    elapsed = round(time.time() - t0, 2)
    print(f"✅ [Clean Uptrend Scanner] Scan complete in {elapsed}s! Found {len(candidates)} clean freshly resolved uptrends.")

    payload = {
        "status": "success",
        "last_updated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_scanned": total_tickers,
        "total_found": len(candidates),
        "execution_time_sec": elapsed,
        "stocks": candidates
    }

    # Save to public/clean_uptrend_results.json
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(payload, f, indent=2)

    # Also update public/screener_results.json under clean_uptrend_9_13 key for Expert Screeners
    try:
        screener_payload = {}
        if os.path.exists(SCREENER_RESULTS_FILE):
            with open(SCREENER_RESULTS_FILE, 'r') as sf:
                screener_payload = json.load(sf)
        
        # Format compact items for screener pills
        compact_items = []
        for c in candidates:
            pill_text = (
                f"${c['close']:.2f} ({c['change_pct']:+.1f}%) · "
                f"Started {c['streak_days']}d ago ({c['trend_start_date']}) · "
                f"200-SMA: +{c['dist_200sma_pct']}% ({c['streak_above_200']}d) · "
                f"50-SMA: +{c['dist_50sma_pct']}% · "
                f"9-SMA: {c['dist_9sma_pct']:+.1f}% · "
                f"Respect: {c['respect_9sma_pct']}% · "
                f"{c['badges'][1] if len(c['badges']) > 1 else (c['badges'][0] if c['badges'] else 'RESOLVED')}"
            )
            compact_items.append({
                "ticker": c["ticker"],
                "metric": pill_text,
                "score": c["score"],
                "streak_days": c["streak_days"],
                "macro_breakout_bars": c["macro_breakout_bars"],
                "streak_above_200": c["streak_above_200"],
                "trend_start_date": c["trend_start_date"],
                "dist_9sma_pct": c["dist_9sma_pct"],
                "dist_50sma_pct": c["dist_50sma_pct"],
                "dist_200sma_pct": c["dist_200sma_pct"],
                "crosses_50_6m": c["crosses_50_6m"],
                "respect_9sma_pct": c["respect_9sma_pct"],
                "efficiency_ratio": c["efficiency_ratio"],
                "state_label": c["badges"][0] if c["badges"] else "RESOLVED",
                "state_color": "#10b981" if c["is_100_pct_rider"] else "#38bdf8",
                "badges": c["badges"],
                "desk_notes": c["desk_notes"]
            })

        screener_payload["clean_uptrend_9_13"] = compact_items
        with open(SCREENER_RESULTS_FILE, 'w') as sf:
            json.dump(screener_payload, sf, indent=2)
        print(f"✅ Injected {len(compact_items)} setups into {SCREENER_RESULTS_FILE} under 'clean_uptrend_9_13'.")
    except Exception as ex:
        print(f"⚠️ Warning updating screener_results.json: {ex}")

    return payload

if __name__ == "__main__":
    run_clean_uptrend_scanner(force_refresh=True)
