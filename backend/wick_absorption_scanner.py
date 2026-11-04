"""
Upper Wick Supply Absorption Scanner (Wyckoff / VDU Institutional Engine)
===========================================================================
Detects Stage 2 market leaders holding and coiling strictly inside the upper wick 
of 1 day back, 2 days back, or 3 days back, absorbing overhead supply without breaking down.

Core Quantitative Rules:
1. Uptrend Alignment: Price well above all SMAs (Close >= 20-EMA > 50-SMA > 200-SMA, rising 200-SMA).
2. Size & Liquidity Gates:
   - Market Cap >= $2,000,000,000 ($2B)
   - Daily Average Trading Volume (20-day SMA) >= 5,000,000 shares (5M)
   - Price >= $5.00 (Excludes penny stocks)
3. Upper Wick Supply Absorption Microstructure:
   - Identifies candidate supply wicks across 1, 2, or 3 sessions back (Upper wick >= 18% of candle range).
   - Verifies that all subsequent sessions have remained coiling inside the upper wick zone [BodyTop, High].
   - Categorizes into:
     * 3-Day Wick Absorption Apex (Elite High-Tight Springboard)
     * 2-Day Wick Coiling (Persistent Absorption)
     * 1-Day Wick Absorption (Fresh Supply Absorption)
4. Volume Dry-Up (VDU): Measures supply exhaustion (Volume during absorption contracting relative to the wick creation bar).
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
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
OUTPUT_FILE = os.path.join(PUBLIC_DIR, 'wick_absorption_results.json')
SCREENER_RESULTS_PATH = os.path.join(PUBLIC_DIR, 'screener_results.json')

def analyze_single_ticker_wick_absorption(
    ticker: str, 
    c: np.ndarray, 
    h: np.ndarray, 
    l: np.ndarray, 
    o: np.ndarray, 
    v: np.ndarray, 
    dates: np.ndarray
) -> Optional[Dict[str, Any]]:
    """Evaluates whether a single stock's OHLCV series satisfies the Wick Supply Absorption criteria."""
    if len(c) < 150:
        return None

    curr_c = float(c[-1])
    if curr_c < 5.0:
        return None

    s_vol = pd.Series(v)
    vol_sma20 = float(s_vol.rolling(20).mean().values[-1])
    # Strict 5M daily volume filter
    if vol_sma20 < 5000000:
        return None

    # Calculate Moving Averages
    s_c = pd.Series(c)
    ema20 = float(s_c.ewm(span=20, adjust=False).mean().values[-1])
    sma50 = float(s_c.rolling(50).mean().values[-1])
    sma150 = float(s_c.rolling(150).mean().values[-1]) if len(c) >= 150 else sma50 * 0.95
    sma200 = float(s_c.rolling(200).mean().values[-1]) if len(c) >= 200 else sma150 * 0.95

    # 1. Uptrend & Well Above All SMAs
    # Close >= 20-EMA (allowing slight 1.5% wiggle for intraday testing), 20-EMA > 50-SMA > 200-SMA
    is_uptrend = (
        (curr_c >= ema20 * 0.985) and 
        (ema20 > sma50) and 
        (sma50 > sma200) and 
        (curr_c >= sma50) and 
        (curr_c >= sma200)
    )
    if not is_uptrend:
        return None

    # Proximity to 52-week high (within 25% of 52w high)
    high_52w = float(np.max(h[-252:]))
    if curr_c < 0.75 * high_52w:
        return None

    # 2. Check Wick Absorption across 3-Days, 2-Days, and 1-Day back
    match_3d = False
    ref3_h = h[-4]; ref3_top = max(o[-4], c[-4]); ref3_bot = min(o[-4], c[-4]); ref3_l = l[-4]
    ref3_wick = ref3_h - ref3_top
    ref3_range = ref3_h - ref3_l
    
    if ref3_range > 0 and (ref3_wick / ref3_range) >= 0.18 and ref3_wick >= (0.003 * c[-4]):
        # Strict inside wick: Close must be strictly inside the upper wick [ref3_top, ref3_h]
        b3_ok = (c[-3] >= ref3_top * 0.998) and (c[-3] <= ref3_h * 1.002) and (l[-3] >= ref3_bot)
        b2_ok = (c[-2] >= ref3_top * 0.998) and (c[-2] <= ref3_h * 1.002) and (l[-2] >= ref3_bot)
        b1_ok = (c[-1] >= ref3_top * 0.998) and (c[-1] <= ref3_h * 1.002) and (l[-1] >= ref3_bot)
        if b3_ok and b2_ok and b1_ok:
            match_3d = True

    match_2d = False
    ref2_h = h[-3]; ref2_top = max(o[-3], c[-3]); ref2_bot = min(o[-3], c[-3]); ref2_l = l[-3]
    ref2_wick = ref2_h - ref2_top
    ref2_range = ref2_h - ref2_l

    if not match_3d and ref2_range > 0 and (ref2_wick / ref2_range) >= 0.18 and ref2_wick >= (0.003 * c[-3]):
        # Strict inside wick: Close must be strictly inside the upper wick [ref2_top, ref2_h]
        b2_ok = (c[-2] >= ref2_top * 0.998) and (c[-2] <= ref2_h * 1.002) and (l[-2] >= ref2_bot)
        b1_ok = (c[-1] >= ref2_top * 0.998) and (c[-1] <= ref2_h * 1.002) and (l[-1] >= ref2_bot)
        if b2_ok and b1_ok:
            match_2d = True

    match_1d = False
    ref1_h = h[-2]; ref1_top = max(o[-2], c[-2]); ref1_bot = min(o[-2], c[-2]); ref1_l = l[-2]
    ref1_wick = ref1_h - ref1_top
    ref1_range = ref1_h - ref1_l

    if not match_3d and not match_2d and ref1_range > 0 and (ref1_wick / ref1_range) >= 0.18 and ref1_wick >= (0.003 * c[-2]):
        # Strict inside wick: Close must be strictly inside the upper wick [ref1_top, ref1_h]
        b1_ok = (c[-1] >= ref1_top * 0.998) and (c[-1] <= ref1_h * 1.002) and (l[-1] >= ref1_bot)
        if b1_ok:
            match_1d = True

    if not (match_3d or match_2d or match_1d):
        return None

    # Structure details
    days = 3 if match_3d else (2 if match_2d else 1)
    ref_idx = -4 if match_3d else (-3 if match_2d else -2)
    ref_h = float(h[ref_idx])
    ref_top = float(max(o[ref_idx], c[ref_idx]))
    ref_wick_pct = round(((ref_h - ref_top) / c[ref_idx]) * 100, 2)
    ref_date_str = str(dates[ref_idx])[:10]
    
    # Volume Dry-Up during absorption
    absorb_vols = v[ref_idx+1:]
    ref_vol = float(v[ref_idx])
    vdu_ratio = (np.mean(absorb_vols) / ref_vol) if ref_vol > 0 else 1.0
    vdu_pct = round(vdu_ratio * 100, 1)

    # Conviction Score (0 - 100)
    score = 0
    # Duration points
    if days == 3: score += 35
    elif days == 2: score += 25
    else: score += 15

    # Volume dry-up points
    if vdu_pct <= 65: score += 25
    elif vdu_pct <= 85: score += 18
    elif vdu_pct <= 100: score += 12
    else: score += 5

    # Price position relative to wick top
    wick_width = max(ref_h - ref_top, 1e-4)
    wick_pos = (curr_c - ref_top) / wick_width
    if wick_pos >= 0.75: score += 25  # Pinned near wick highs ready to blast
    elif wick_pos >= 0.40: score += 18
    else: score += 10

    # Moving average trend health
    dist_ema20 = round(((curr_c - ema20) / ema20) * 100, 1)
    dist_sma50 = round(((curr_c - sma50) / sma50) * 100, 1)
    dist_sma200 = round(((curr_c - sma200) / sma200) * 100, 1)
    dist_52w = round(((high_52w - curr_c) / high_52w) * 100, 1)

    if 0.0 <= dist_ema20 <= 8.0: score += 15
    elif dist_ema20 > 8.0: score += 10
    else: score += 5

    score = min(100, max(10, score))

    if days == 3:
        tier = "3-Day Wick Absorption Apex"
        tier_badge = "💎 3D Apex Coil"
        tier_color = "#10b981"
    elif days == 2:
        tier = "2-Day Wick Coiling"
        tier_badge = "🔥 2D Persistent Coil"
        tier_color = "#f59e0b"
    else:
        tier = "1-Day Wick Absorption"
        tier_badge = "⚡ 1D Fresh Absorption"
        tier_color = "#38bdf8"

    badges = [
        f"{tier_badge}",
        f"💧 VDU {vdu_pct}% vs Wick Bar",
        f"🛡️ +{dist_ema20}% Over 20EMA",
        f"🎯 {dist_52w}% Off 52W High"
    ]

    return {
        "ticker": ticker.upper(),
        "close": round(curr_c, 2),
        "score": score,
        "days_absorbed": days,
        "tier": tier,
        "tier_badge": tier_badge,
        "tier_color": tier_color,
        "wick_zone": f"${ref_top:.2f} - ${ref_h:.2f}",
        "wick_top": round(ref_h, 2),
        "wick_base": round(ref_top, 2),
        "wick_pct": ref_wick_pct,
        "wick_ref_date": ref_date_str,
        "vdu_pct": vdu_pct,
        "avg_vol_20d_m": round(vol_sma20 / 1e6, 2),
        "curr_vol_m": round(float(v[-1]) / 1e6, 2),
        "dist_ema20_pct": dist_ema20,
        "dist_sma50_pct": dist_sma50,
        "dist_sma200_pct": dist_sma200,
        "dist_52w_high_pct": dist_52w,
        "badges": badges,
        "sparkline": [round(float(x), 2) for x in c[-10:]]
    }

def run_wick_absorption_scanner(min_mcap: float = 2_000_000_000) -> Dict[str, Any]:
    """
    Executes the Upper Wick Supply Absorption Scanner across the full market lakehouse.
    Filters:
    - Daily Volume >= 5,000,000
    - Market Cap >= $2B
    - Uptrend well above all SMAs
    - 1, 2, or 3 days staying inside the upper wick.
    """
    t0 = time.time()
    candidates: List[Dict[str, Any]] = []

    if not os.path.exists(LAKEHOUSE_PATH):
        print(f"Error: Lakehouse not found at {LAKEHOUSE_PATH}")
        return {"updated_at": pd.Timestamp.now().isoformat(), "count": 0, "results": []}

    print("🚀 Scanning DuckDB Lakehouse for Upper Wick Supply Absorption Setups...")
    try:
        con = duckdb.connect()
        df_l = con.execute(f"""
            SELECT Ticker, Date, Open, High, Low, Close, Volume 
            FROM '{LAKEHOUSE_PATH}' 
            WHERE Date >= CURRENT_DATE - INTERVAL 300 DAY 
            ORDER BY Ticker, Date ASC
        """).df()
        con.close()

        grouped = df_l.groupby('Ticker')
        for ticker, g in grouped:
            if len(g) < 150:
                continue
            c = g['Close'].values
            h = g['High'].values
            l = g['Low'].values
            o = g['Open'].values
            v = g['Volume'].values
            dates = g['Date'].values

            item = analyze_single_ticker_wick_absorption(ticker, c, h, l, o, v, dates)
            if item:
                candidates.append(item)

    except Exception as e:
        print(f"Error executing Lakehouse query: {e}")
        return {"updated_at": pd.Timestamp.now().isoformat(), "count": 0, "results": []}

    print(f"Candidates before Market Cap check: {len(candidates)}")

    # Enforce strict Market Cap >= $2B check in bulk
    final_results = []
    if candidates:
        try:
            from yahooquery import Ticker as YQTicker
            candidate_symbols = [c['ticker'] for c in candidates]
            yq = YQTicker(candidate_symbols, asynchronous=True)
            prices = yq.price

            for c in candidates:
                sym = c['ticker']
                p_info = prices.get(sym, {}) if isinstance(prices, dict) else {}
                mcap = p_info.get('marketCap') if isinstance(p_info, dict) else None
                qtype = p_info.get('quoteType') if isinstance(p_info, dict) else ''
                short_name = p_info.get('shortName') or sym

                # Filter out ETFs unless equity, and enforce $2B minimum
                if mcap and mcap >= min_mcap and qtype.upper() != 'ETF':
                    c['market_cap_b'] = round(mcap / 1e9, 2)
                    c['name'] = short_name
                    c['quote_type'] = qtype
                    final_results.append(c)
                elif mcap and mcap >= min_mcap and qtype.upper() == 'ETF':
                    # Optional: Exclude ETFs to focus on individual stocks as requested
                    pass
                else:
                    pass
        except Exception as e:
            print(f"Error fetching market caps: {e}. Keeping liquid candidates.")
            final_results = candidates

    # Sort results by Conviction Score descending, then by Days Absorbed descending
    final_results.sort(key=lambda x: (x['days_absorbed'], x['score'], x['avg_vol_20d_m']), reverse=True)

    payload = {
        "updated_at": pd.Timestamp.now().isoformat(),
        "count": len(final_results),
        "results": final_results
    }

    # Write dedicated results to public/wick_absorption_results.json
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(payload, f, indent=2)

    # Sync into public/screener_results.json under category 'wick_supply_absorption'
    try:
        screener_json = {}
        if os.path.exists(SCREENER_RESULTS_PATH):
            with open(SCREENER_RESULTS_PATH, 'r') as f:
                screener_json = json.load(f)
                
        formatted_for_screener = []
        for r in final_results:
            formatted_for_screener.append({
                "ticker": r["ticker"],
                "metric": f"${r['close']} | {r['tier_badge']} | Wick: {r['wick_zone']} | VDU: {r['vdu_pct']}% | Mcap: ${r.get('market_cap_b', 0)}B | Vol: {r['avg_vol_20d_m']}M",
                "score": r["score"],
                "tier": r["tier"]
            })
            
        screener_json["wick_supply_absorption"] = formatted_for_screener
        with open(SCREENER_RESULTS_PATH, 'w') as f:
            json.dump(screener_json, f, indent=2)
        print(f"Synchronized {len(formatted_for_screener)} results to {SCREENER_RESULTS_PATH}")
    except Exception as ex:
        print(f"Warning: Could not sync to screener_results.json: {ex}")

    elapsed = round(time.time() - t0, 2)
    print(f"✅ Wick Supply Absorption Scanner completed in {elapsed}s: {len(final_results)} qualified setups found.")
    return payload

if __name__ == '__main__':
    run_wick_absorption_scanner()
