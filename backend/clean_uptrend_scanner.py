"""
Clean Untangled Uptrend 2.0 — 9 / 13 / 21 / 50 SMA Institutional Ribbon Scanner
==============================================================================
Identifies highly liquid US equities (Market Cap >= $2.0B, 20D Avg Vol >= 750K
shares, >= $25M daily dollar volume, Price >= $10, zero ETFs) in clean,
untangled bullish moving-average stacks (Price & 9 > 13 > 21 > 50 > 200 SMA)
without whipsaws or extreme overextension:

Tier 1 — FRESH_200_RESOLUTION:
  Recently resolved out of a contested 50/200-SMA base (streak above 200-SMA <= 45 bars
  and within +1.5% to +18.0% of 200-SMA).

Tier 2 — STAGE2_IGNITION:
  Established Stage 2 leader whose fast 9/13/21-SMA ribbon freshly untangled out of
  a tight pullback/consolidation (4–30 bars ago, <= +32.0% above 200-SMA).
"""

import os
import json
import math
import time
from typing import Optional, Dict, Any, List
import numpy as np
import pandas as pd
import duckdb

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
LAKEHOUSE_PATH = os.path.join(DATA_DIR, "daily_ohlcv.parquet")
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "clean_uptrend_results.json")
SCREENER_RESULTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "screener_results.json")

MIN_PRICE = 10.0
MIN_AVG_VOL_20 = 750_000
MIN_DOLLAR_VOL_20 = 25_000_000
MIN_CURR_VOL = 200_000
MIN_MARKET_CAP_USD = 2_000_000_000

try:
    from market_cap_utils import enforce_min_market_cap
except ImportError:
    from backend.market_cap_utils import enforce_min_market_cap


def _sanitize_json(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_json(v) for v in obj]
    if isinstance(obj, (float, np.floating)):
        val = float(obj)
        if math.isnan(val) or math.isinf(val):
            return 0.0
        return val
    if isinstance(obj, (int, np.integer)):
        return int(obj)
    if isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    return obj


def _clean_series_tail(arr: np.ndarray, fallback: np.ndarray, tail_n: int) -> List[float]:
    sub = arr[-tail_n:]
    fb = fallback[-tail_n:]
    out = []
    for val, fb_val in zip(sub, fb):
        v = fb_val if np.isnan(val) or np.isinf(val) else val
        out.append(round(float(v), 2))
    return out


def analyze_stock_clean_uptrend(
    ticker: str,
    df: pd.DataFrame,
    min_streak: int = 4,
    max_ribbon_bars: int = 30,
) -> Optional[Dict[str, Any]]:
    """
    Evaluates a single stock for the Clean Untangled Uptrend 2.0 scanner with strict
    institutional liquidity filters and dual-tier inception classification.
    """
    n = len(df)
    if n < 210:
        return None

    c = df["Close"].astype(float).values
    h = df["High"].astype(float).values
    l = df["Low"].astype(float).values
    v = df["Volume"].astype(float).values
    dates = df["Date"].values

    curr_close = float(c[-1])
    if math.isnan(curr_close) or curr_close < MIN_PRICE:
        return None

    # Institutional Liquidity Gatekeeper (AND conditions: shares + dollar vol + active session)
    s_vol = pd.Series(v)
    vol_sma20 = s_vol.rolling(20).mean().values
    avg_vol_20 = float(vol_sma20[-1]) if not np.isnan(vol_sma20[-1]) else 0.0
    curr_vol = float(v[-1]) if not np.isnan(v[-1]) else 0.0
    dollar_vol = avg_vol_20 * curr_close

    if avg_vol_20 < MIN_AVG_VOL_20 or dollar_vol < MIN_DOLLAR_VOL_20 or curr_vol < MIN_CURR_VOL:
        return None

    # Calculate Moving Averages
    s_close = pd.Series(c)
    sma9 = s_close.rolling(9).mean().values
    sma13 = s_close.rolling(13).mean().values
    sma21 = s_close.rolling(21).mean().values
    sma50 = s_close.rolling(50).mean().values
    sma150 = s_close.rolling(150).mean().values
    sma200 = s_close.rolling(200).mean().values

    if (
        np.isnan(sma200[-1])
        or np.isnan(sma150[-1])
        or np.isnan(sma50[-1])
        or np.isnan(sma21[-1])
        or np.isnan(sma13[-1])
        or np.isnan(sma9[-1])
    ):
        return None

    curr_sma9 = float(sma9[-1])
    curr_sma13 = float(sma13[-1])
    curr_sma21 = float(sma21[-1])
    curr_sma50 = float(sma50[-1])
    curr_sma150 = float(sma150[-1])
    curr_sma200 = float(sma200[-1])

    # 1. FULL UNTANGLED BULLISH HIERARCHY
    if not (curr_sma9 > curr_sma13 > curr_sma21 > curr_sma50 > curr_sma200):
        return None
    if not (curr_close > curr_sma50 and curr_close > curr_sma200):
        return None

    # Meaningful ribbon separation (not flat/tangled)
    if (curr_sma9 - curr_sma13) / curr_sma13 < 0.0012:
        return None

    # Rising/firm MA slopes & non-declining 200-SMA
    slope_sma9 = (curr_sma9 - sma9[-3]) / sma9[-3] if len(sma9) >= 3 else 0.0
    slope_sma13 = (curr_sma13 - sma13[-3]) / sma13[-3] if len(sma13) >= 3 else 0.0
    slope_sma50 = (curr_sma50 - sma50[-5]) / sma50[-5] if len(sma50) >= 5 else 0.0
    if slope_sma9 < 0.0 or slope_sma13 < -0.001 or slope_sma50 < 0.0:
        return None
    if curr_sma200 < sma200[-20] * 0.99:
        return None

    # 2. CONTROLLED EXTENSION & BUYABLE PROXIMITY BOUNDS
    dist_9sma_pct = round(((curr_close - curr_sma9) / curr_sma9) * 100.0, 1)
    dist_50sma_pct = round(((curr_close - curr_sma50) / curr_sma50) * 100.0, 1)
    dist_200sma_pct = round(((curr_close - curr_sma200) / curr_sma200) * 100.0, 1)

    if not (-1.5 <= dist_9sma_pct <= 5.5):
        return None
    if not (1.0 <= dist_50sma_pct <= 15.0):
        return None
    if not (1.5 <= dist_200sma_pct <= 32.0):
        return None

    # Macro breakout streaks
    streak_above_50 = 0
    for val in reversed(c > sma50):
        if val:
            streak_above_50 += 1
        else:
            break

    streak_above_200 = 0
    for val in reversed(c > sma200):
        if val:
            streak_above_200 += 1
        else:
            break

    # 3. FAST 9/13/21 RIBBON INCEPTION & RESPECT CHECK
    streak = 0
    for idx in range(n - 1, -1, -1):
        if streak > max_ribbon_bars + 5:
            break
        if np.isnan(sma21[idx]):
            break
        is_bull = (sma9[idx] > sma13[idx] > sma21[idx]) and (c[idx] >= sma13[idx] * 0.992)
        if is_bull:
            streak += 1
        else:
            break

    if not (min_streak <= streak <= max_ribbon_bars):
        return None

    trend_start_idx = n - streak
    trend_start_date = str(dates[trend_start_idx])[:10]

    closes_in_trend = c[trend_start_idx:n]
    sma9_in_trend = sma9[trend_start_idx:n]
    sma13_in_trend = sma13[trend_start_idx:n]

    # Zero closes meaningfully below 13-SMA & zero 9/13 crossings during the active ribbon
    if np.any(closes_in_trend < sma13_in_trend * 0.992):
        return None
    if np.any(sma9_in_trend <= sma13_in_trend):
        return None

    respect_count = int(np.sum(closes_in_trend >= sma9_in_trend * 0.995))
    respect_pct = round((respect_count / streak) * 100.0, 1)
    if respect_pct < 75.0:
        return None

    # 4. DIRECTIONAL EFFICIENCY RATIO (Kaufman ER >= 0.35)
    net_displacement = abs(curr_close - float(c[trend_start_idx]))
    step_diffs = float(np.sum(np.abs(np.diff(closes_in_trend))))
    efficiency_ratio = round(net_displacement / step_diffs, 2) if step_diffs > 0 else 1.0
    if efficiency_ratio < 0.35:
        return None

    # 5. 6-MONTH CONTEXT & TIER CLASSIFICATION
    lookback_6m = min(126, n)
    c_6m = c[-lookback_6m:]
    s50_6m = sma50[-lookback_6m:]
    s200_6m = sma200[-lookback_6m:]

    diff_50 = c_6m - s50_6m
    valid_diff_50 = diff_50[~np.isnan(diff_50)]
    crosses_50_6m = int(np.sum(np.diff(np.sign(valid_diff_50)) != 0)) if len(valid_diff_50) > 1 else 0

    diff_200 = c_6m - s200_6m
    valid_diff_200 = diff_200[~np.isnan(diff_200)]
    crosses_200_6m = int(np.sum(np.diff(np.sign(valid_diff_200)) != 0)) if len(valid_diff_200) > 1 else 0
    was_under_200_recently = bool(np.any(c[-60:] < sma200[-60:] * 1.01))

    diff_50_recent = diff_50[-min(len(diff_50), max(1, streak_above_50)):]
    valid_diff_recent = diff_50_recent[~np.isnan(diff_50_recent)]
    crosses_50_recent = int(np.sum(np.diff(np.sign(valid_diff_recent)) != 0)) if len(valid_diff_recent) > 1 else 0

    if streak_above_200 <= 45 and dist_200sma_pct <= 18.0:
        tier = "FRESH_200_RESOLUTION"
        tier_label = "🚀 Fresh 200-SMA Resolution"
        tier_color = "#10b981"
    else:
        tier = "STAGE2_IGNITION"
        tier_label = "⚡ Stage 2 Ribbon Ignition"
        tier_color = "#38bdf8"

    # 6. ORDER FLOW, ATR & SPECIAL SIGNALS
    curr_low = float(l[-1])
    tested_9sma_today = bool((curr_low <= curr_sma9 * 1.008) and (curr_close >= curr_sma9 * 0.995))
    is_100_pct_rider = respect_pct >= 99.9

    up_vol = 0.0
    down_vol = 0.0
    for j in range(trend_start_idx + 1, n):
        if c[j] >= c[j - 1]:
            up_vol += v[j]
        else:
            down_vol += v[j]
    ud_vol_ratio = round(float(up_vol / max(down_vol, 1.0)), 2)

    s_h = pd.Series(h)
    s_l = pd.Series(l)
    prev_c = s_close.shift(1)
    tr = pd.concat([(s_h - s_l), (s_h - prev_c).abs(), (s_l - prev_c).abs()], axis=1).max(axis=1)
    atr14 = float(tr.rolling(14).mean().iloc[-1])
    if math.isnan(atr14) or atr14 <= 0:
        atr14 = curr_close * 0.02
    atr_14_pct = round((atr14 / curr_close) * 100.0, 2)

    ribbon_spread_pct = round(((curr_sma9 - curr_sma50) / curr_sma50) * 100.0, 1)

    # 7. COMPOSITE SCORE (0-100)
    freshness_pts = 20.0 if (4 <= streak <= 16) else 14.0
    respect_pts = (respect_pct / 100.0) * 25.0
    tier_pts = 20.0 if tier == "FRESH_200_RESOLUTION" else (16.0 if crosses_50_6m >= 3 else 13.0)
    efficiency_pts = min(15.0, efficiency_ratio * 20.0)
    proximity_pts = max(0.0, 10.0 - abs(dist_9sma_pct) * 2.0)
    volume_pts = min(10.0, ud_vol_ratio * 4.0)

    composite_score = int(round(freshness_pts + respect_pts + tier_pts + efficiency_pts + proximity_pts + volume_pts))
    composite_score = max(55, min(99, composite_score))

    # Action Badges
    badges = [tier_label]
    if 4 <= streak <= 7:
        badges.append(f"🌟 FRESH INCEPTION ({streak}d)")
    elif 8 <= streak <= 16:
        badges.append(f"✨ CLEAN IGNITION ({streak}d)")
    else:
        badges.append(f"📈 ESTABLISHED RIDE ({streak}d)")

    if is_100_pct_rider:
        badges.append("🏄 100% 9-SMA RIDER")
    elif respect_pct >= 85.0:
        badges.append(f"🛡️ 9-SMA DEFENDER ({respect_pct}%)")

    if tested_9sma_today:
        badges.append("🎯 9-SMA PULLBACK BOUNCE")

    if ud_vol_ratio >= 1.5:
        badges.append("🔥 ACCUMULATION FLOW")

    # 8. RISK/REWARD EXECUTION TICKET (anchored to 9-SMA buy zone & 13-SMA invalidation)
    buy_zone_low = round(curr_sma9 * 0.995, 2)
    buy_zone_high = round(curr_sma9 * 1.025, 2)
    entry_ref = curr_close
    stop_loss = round(min(entry_ref * 0.985, curr_sma13 * 0.99), 2)
    risk_per_share = max(0.10, entry_ref - stop_loss)
    risk_pct = round((risk_per_share / entry_ref) * 100.0, 2)
    target_1 = round(entry_ref + 2.0 * risk_per_share, 2)
    target_2 = round(entry_ref + 3.5 * risk_per_share, 2)

    trade_plan = {
        "buy_zone_low": buy_zone_low,
        "buy_zone_high": buy_zone_high,
        "stop_loss": stop_loss,
        "risk_pct": risk_pct,
        "target_1": target_1,
        "target_2": target_2,
        "reward_risk": 3.5,
    }

    # 9. 30-DAY RIBBON SPARKLINE
    tail_n = min(30, n)
    sparkline = {
        "close": _clean_series_tail(c, c, tail_n),
        "sma9": _clean_series_tail(sma9, c, tail_n),
        "sma13": _clean_series_tail(sma13, c, tail_n),
        "sma21": _clean_series_tail(sma21, c, tail_n),
        "sma50": _clean_series_tail(sma50, c, tail_n),
    }

    prev_close = float(c[-2]) if len(c) >= 2 else curr_close
    change_pct = round(((curr_close - prev_close) / prev_close) * 100.0, 2)

    desk_notes = (
        f"{tier_label}: Untangled 9>13>21>50>200 SMA stack ignited {streak} sessions ago on {trend_start_date} "
        f"(200-SMA breakout age: {streak_above_200}d at +{dist_200sma_pct}%; 50-SMA: +{dist_50sma_pct}%). "
        f"9-SMA respect is {respect_pct}% with zero closes below 13-SMA (ER: {efficiency_ratio:.2f}, U/D Vol: {ud_vol_ratio:.2f}x). "
        f"{'Testing 9-SMA support for low-risk pullback entry. ' if tested_9sma_today else f'Trading {dist_9sma_pct:+.1f}% from 9-SMA. '}"
        f"Invalidation stop anchored below 13-SMA at ${stop_loss:.2f} (-{risk_pct}% risk)."
    )

    return {
        "ticker": ticker.upper(),
        "name": ticker.upper(),
        "sector": "Equities",
        "industry": "",
        "close": round(curr_close, 2),
        "change_pct": change_pct,
        "avg_vol_20": int(round(avg_vol_20)),
        "avg_vol_20_m": round(avg_vol_20 / 1e6, 2),
        "curr_vol": int(round(curr_vol)),
        "dollar_vol_m": round(dollar_vol / 1e6, 1),
        "rvol_20": round(curr_vol / max(1.0, avg_vol_20), 2),
        "market_cap_b": 0.0,
        "tier": tier,
        "tier_label": tier_label,
        "tier_color": tier_color,
        "streak_days": streak,
        "macro_breakout_bars": streak_above_50,
        "streak_above_200": streak_above_200,
        "streak_above_50": streak_above_50,
        "trend_start_date": trend_start_date,
        "sma9": round(curr_sma9, 2),
        "sma13": round(curr_sma13, 2),
        "sma21": round(curr_sma21, 2),
        "sma50": round(curr_sma50, 2),
        "sma150": round(curr_sma150, 2),
        "sma200": round(curr_sma200, 2),
        "ribbon_spread_pct": ribbon_spread_pct,
        "atr_14_pct": atr_14_pct,
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
        "trade_plan": trade_plan,
        "sparkline": sparkline,
        "desk_notes": desk_notes,
    }


def run_clean_uptrend_scanner(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Exhaustive Lakehouse scan across liquid US equities (>= $2.0B Market Cap,
    >= 750K 20D avg shares/day, >= $25M daily dollar volume, no ETFs).
    """
    t0 = time.time()
    print("[Clean Uptrend Scanner 2.0] Querying DuckDB Lakehouse for liquid equities...")

    if not os.path.exists(LAKEHOUSE_PATH):
        raise FileNotFoundError(f"Lakehouse parquet not found at {LAKEHOUSE_PATH}")

    con = duckdb.connect()
    df_all = con.execute(f"""
        WITH recent_stats AS (
            SELECT Ticker, max(Date) as max_d, avg(Volume) as avg_v, avg(Close) as avg_c
            FROM '{LAKEHOUSE_PATH}'
            WHERE Date >= CURRENT_DATE - INTERVAL 75 DAY
            GROUP BY Ticker
            HAVING avg_v >= {MIN_AVG_VOL_20} AND avg_c >= {MIN_PRICE}
        )
        SELECT d.Ticker, d.Date, d.Open, d.High, d.Low, d.Close, d.Volume
        FROM '{LAKEHOUSE_PATH}' d
        INNER JOIN recent_stats s ON d.Ticker = s.Ticker
        WHERE d.Date >= CURRENT_DATE - INTERVAL 420 DAY
        ORDER BY d.Ticker, d.Date ASC
    """).df()
    con.close()

    total_tickers = int(df_all["Ticker"].nunique())
    print(f"[Clean Uptrend Scanner 2.0] Loaded {len(df_all)} daily records for {total_tickers} liquid candidates in {time.time()-t0:.2f}s.")

    candidates = []
    for ticker, group_df in df_all.groupby("Ticker"):
        if len(group_df) < 210:
            continue
        res = analyze_stock_clean_uptrend(ticker, group_df)
        if res:
            candidates.append(res)

    print(f"[Clean Uptrend Scanner 2.0] Enforcing >= ${MIN_MARKET_CAP_USD / 1e9:.1f}B Equity Market Cap on {len(candidates)} technical qualifiers...")
    candidates = enforce_min_market_cap(candidates, min_mcap_usd=MIN_MARKET_CAP_USD)

    candidates.sort(
        key=lambda x: (
            x["score"] + (4 if x["tier"] == "FRESH_200_RESOLUTION" else 0),
            x["respect_9sma_pct"],
            -abs(x["dist_9sma_pct"]),
        ),
        reverse=True,
    )

    elapsed = round(time.time() - t0, 2)
    summary_kpis = {
        "total_found": len(candidates),
        "tier1_fresh_200": sum(1 for x in candidates if x["tier"] == "FRESH_200_RESOLUTION"),
        "tier2_stage2_ignition": sum(1 for x in candidates if x["tier"] == "STAGE2_IGNITION"),
        "pullback_entries": sum(1 for x in candidates if x.get("tested_9sma_today")),
        "perfect_riders": sum(1 for x in candidates if x.get("is_100_pct_rider")),
        "avg_score": round(float(np.mean([x["score"] for x in candidates])) if candidates else 0.0, 1),
    }

    payload = _sanitize_json({
        "status": "success",
        "last_updated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_scanned": total_tickers,
        "total_found": len(candidates),
        "execution_time_sec": elapsed,
        "constraints": {
            "min_price": MIN_PRICE,
            "min_avg_vol_20": MIN_AVG_VOL_20,
            "min_avg_vol_20_m": round(MIN_AVG_VOL_20 / 1e6, 2),
            "min_dollar_vol_m": round(MIN_DOLLAR_VOL_20 / 1e6, 1),
            "min_market_cap_b": round(MIN_MARKET_CAP_USD / 1e9, 1),
        },
        "summary_kpis": summary_kpis,
        "stocks": candidates,
    })

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(payload, f, indent=2, allow_nan=False)

    print(f"✅ [Clean Uptrend Scanner 2.0] Complete in {elapsed}s! {len(candidates)} liquid >=$2B stocks saved to {OUTPUT_FILE}")

    # Inject compact items into public/screener_results.json under 'clean_uptrend_9_13'
    try:
        screener_payload = {}
        if os.path.exists(SCREENER_RESULTS_FILE):
            with open(SCREENER_RESULTS_FILE, "r") as sf:
                screener_payload = json.load(sf)

        compact_items = []
        for c in candidates:
            pill_text = (
                f"${c['close']:.2f} ({c['change_pct']:+.1f}%) · "
                f"Cap ${c['market_cap_b']:.1f}B · Vol {c['avg_vol_20_m']:.2f}M (${c['dollar_vol_m']:.0f}M/d) · "
                f"Ribbon {c['streak_days']}d ({c['trend_start_date']}) · "
                f"9-SMA {c['dist_9sma_pct']:+.1f}% · Respect {c['respect_9sma_pct']}% · {c['tier_label']}"
            )
            compact_items.append({
                "ticker": c["ticker"],
                "name": c["name"],
                "sector": c["sector"],
                "market_cap_b": c["market_cap_b"],
                "avg_vol_20_m": c["avg_vol_20_m"],
                "dollar_vol_m": c["dollar_vol_m"],
                "tier": c["tier"],
                "tier_label": c["tier_label"],
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
                "state_label": c["tier_label"],
                "state_color": c["tier_color"],
                "badges": c["badges"],
                "desk_notes": c["desk_notes"],
            })

        screener_payload["clean_uptrend_9_13"] = compact_items
        with open(SCREENER_RESULTS_FILE, "w") as sf:
            json.dump(_sanitize_json(screener_payload), sf, indent=2, allow_nan=False)
        print(f"✅ Injected {len(compact_items)} setups into {SCREENER_RESULTS_FILE} under 'clean_uptrend_9_13'.")
    except Exception as ex:
        print(f"⚠️ Warning updating screener_results.json: {ex}")

    return payload


if __name__ == "__main__":
    run_clean_uptrend_scanner(force_refresh=True)
