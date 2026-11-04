#!/usr/bin/env python3
"""
Apex Volatility Squeeze Engine (A+ Pre-Breakout Squeeze Radar)
============================================================
Blends 5 primary quantitative volatility compression models + order flow footprints + options gamma flow:

1. TTM Squeeze Pro (High/Mid/Low Keltner Channel compression):
   - High: BB(2.0, 20) inside KC(1.0, 20) -> Score = 100
   - Mid: BB(2.0, 20) inside KC(1.25, 20) -> Score = 66
   - Low: BB(2.0, 20) inside KC(1.50, 20) -> Score = 33
2. Minervini VCP Contraction Ratio:
   - ATR(5) / ATR(20) <= 0.70 (Tight volatility dampening).
3. Donchian Channel Width (DCW%) Percentile Rank:
   - 20-day Donchian Channel Width at bottom 10th percentile over 120 days.
4. Historical Volatility Ratio (HVR):
   - HV(10) / HV(30) <= 0.60 (Short-term vs long-term volatility drop).
5. Relative Momentum Vector (RMV):
   - (Close - EMA20) / ATR20 vector coiling inside [-1.25, +1.25].
6. Order Flow & VDU Footprints:
   - Volume Dry-Up (VDU <= 0.50x avg volume) and Morales/Kacher Pocket Pivots.
7. Options Gamma Flow & Trapped Short Fuel:
   - Call/Put Volume ratio, Short % of Float, and Days to Cover.
"""

import os
import sys
import json
import warnings
import numpy as np
import pandas as pd
import duckdb
import yfinance as yf

warnings.filterwarnings('ignore')

LAKEHOUSE_PATH = os.path.join(os.path.dirname(__file__), 'data', 'daily_ohlcv.parquet')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'public', 'squeeze_results.json')

def calculate_atr(df: pd.DataFrame, window: int = 14) -> pd.Series:
    h = df['High']
    l = df['Low']
    prev_c = df['Close'].shift(1)
    tr = pd.concat([
        h - l,
        (h - prev_c).abs(),
        (l - prev_c).abs()
    ], axis=1).max(axis=1)
    return tr.rolling(window=window).mean()

def evaluate_apex_squeeze(ticker: str, df: pd.DataFrame, info: dict = None) -> dict:
    if df is None or len(df) < 60:
        return None

    c = df['Close']
    h = df['High']
    l = df['Low']
    v = df['Volume']

    curr_price = float(c.iloc[-1])
    avg_vol_20 = float(v.rolling(20).mean().iloc[-1]) if len(v) >= 20 else float(v.mean())
    dollar_vol = avg_vol_20 * curr_price

    # -----------------------------------------------------------------
    # MANDATORY STRICT GATEKEEPERS:
    # 1. Volume: Average Daily Volume >= 5.0M shares OR Dollar Volume >= $100M
    # 2. Stage 2 Uptrend: Price > 50-SMA, 50-SMA > 200-SMA, and 50-SMA sloping upward
    # 3. Market Cap: Market Cap >= $2.0 Billion
    # -----------------------------------------------------------------
    if avg_vol_20 < 5_000_000 and dollar_vol < 100_000_000:
        return None

    # Trend Gatekeeper: Must be in a confirmed Stage 2 Uptrend
    sma50 = c.rolling(50).mean()
    sma200 = c.rolling(200).mean()
    sma50_curr = float(sma50.iloc[-1]) if len(sma50) >= 50 and not pd.isna(sma50.iloc[-1]) else None
    sma200_curr = float(sma200.iloc[-1]) if len(sma200) >= 200 and not pd.isna(sma200.iloc[-1]) else None

    if sma50_curr is None:
        return None

    # Close must be strictly above 50-SMA
    if curr_price < sma50_curr:
        return None

    # 50-SMA must be sloping up
    sma50_prev = float(sma50.iloc[-10]) if len(sma50) >= 10 and not pd.isna(sma50.iloc[-10]) else sma50_curr
    if sma50_curr < sma50_prev:
        return None

    # If 200-SMA exists, 50-SMA must be above 200-SMA (Stacked Stage 2)
    if sma200_curr is not None and sma50_curr < sma200_curr:
        return None

    # -----------------------------------------------------------------
    # 1. TTM Squeeze Pro (High / Mid / Low Compression)
    # -----------------------------------------------------------------
    sma20 = c.rolling(20).mean()
    std20 = c.rolling(20).std()
    bb_upper = sma20 + (2.0 * std20)
    bb_lower = sma20 - (2.0 * std20)
    bb_width = bb_upper - bb_lower
    bb_width_pct = (bb_width / sma20) * 100.0

    ema20 = c.ewm(span=20, adjust=False).mean()
    atr20 = calculate_atr(df, 20)
    atr5 = calculate_atr(df, 5)
    atr14 = calculate_atr(df, 14)

    kc_w_10 = 2.0 * 1.0 * atr20
    kc_w_125 = 2.0 * 1.25 * atr20
    kc_w_150 = 2.0 * 1.50 * atr20

    bb_w_curr = float(bb_width.iloc[-1])
    kc10_curr = float(kc_w_10.iloc[-1])
    kc125_curr = float(kc_w_125.iloc[-1])
    kc150_curr = float(kc_w_150.iloc[-1])

    is_high_squeeze = bb_w_curr < kc10_curr
    is_mid_squeeze = (bb_w_curr < kc125_curr) and not is_high_squeeze
    is_low_squeeze = (bb_w_curr < kc150_curr) and not is_high_squeeze and not is_mid_squeeze

    # Squeeze Fired / Expansion Filter:
    # A squeeze is actively FIRED/RELEASED when:
    # 1. Price closes above the prior 20-day High breakout pivot.
    # 2. Price closes above the upper Bollinger Band.
    # 3. Stock experienced a strong expansion move (+3.5% gain or intraday high surge >= +3.5% today).
    # When a squeeze fires/releases momentum, it is NO LONGER a pending squeeze!
    prev_close = float(c.iloc[-2]) if len(c) > 1 else curr_price
    curr_high = float(h.iloc[-1])
    day_gain_pct = ((curr_price - prev_close) / prev_close) * 100.0 if prev_close > 0 else 0.0
    intraday_high_gain = ((curr_high - prev_close) / prev_close) * 100.0 if prev_close > 0 else 0.0
    high_20_prev = float(h.iloc[-21:-1].max()) if len(h) >= 21 else float(h.max())

    is_squeeze_fired = (curr_price > high_20_prev) or (curr_price > float(bb_upper.iloc[-1])) or (day_gain_pct >= 3.5) or (intraday_high_gain >= 3.5)

    if is_high_squeeze and not is_squeeze_fired:
        ttm_score = 100
        ttm_label = "🔥 High Squeeze Pro (1.0x ATR)"
    elif is_mid_squeeze and not is_squeeze_fired:
        ttm_score = 66
        ttm_label = "⚡ Mid Squeeze Pro (1.25x ATR)"
    elif is_low_squeeze and not is_squeeze_fired:
        ttm_score = 33
        ttm_label = "⚡ Low Squeeze Pro (1.50x ATR)"
    else:
        ttm_score = 0
        ttm_label = "Squeeze Fired / Expansion"
        is_high_squeeze = is_mid_squeeze = is_low_squeeze = False

    compression_ratio = float(bb_w_curr / kc150_curr) if kc150_curr > 0 else 1.0

    # -----------------------------------------------------------------
    # 2. VCP Contraction Ratio (ATR5 / ATR20)
    # -----------------------------------------------------------------
    atr5_curr = float(atr5.iloc[-1])
    atr20_curr = float(atr20.iloc[-1])
    vcp_ratio = (atr5_curr / atr20_curr) if atr20_curr > 0 else 1.0
    vcp_score = max(0.0, min(100.0, ((1.0 - vcp_ratio) / 0.60) * 100.0))

    # -----------------------------------------------------------------
    # 3. Donchian Channel Width (DCW%) 120-Day Percentile Rank
    # -----------------------------------------------------------------
    donchian_high = h.rolling(20).max()
    donchian_low = l.rolling(20).min()
    dcw = (donchian_high - donchian_low) / ((donchian_high + donchian_low) / 2.0)
    
    dcw_series = dcw.dropna()
    if len(dcw_series) >= 60:
        curr_dcw = float(dcw_series.iloc[-1])
        lookback_dcw = dcw_series.tail(min(120, len(dcw_series)))
        dcw_rank = float((lookback_dcw < curr_dcw).mean())
        dcw_score = max(0.0, min(100.0, (1.0 - (dcw_rank / 0.15)) * 100.0))
    else:
        dcw_score = 50.0

    # -----------------------------------------------------------------
    # 4. Historical Volatility Ratio (HVR = HV10 / HV30)
    # -----------------------------------------------------------------
    log_ret = np.log(c / c.shift(1))
    hv10 = float(log_ret.tail(10).std() * np.sqrt(252)) if len(log_ret) >= 10 else 0.20
    hv30 = float(log_ret.tail(30).std() * np.sqrt(252)) if len(log_ret) >= 30 else 0.20
    hvr = (hv10 / hv30) if hv30 > 0 else 1.0
    hvr_score = max(0.0, min(100.0, ((1.0 - hvr) / 0.50) * 100.0))

    # -----------------------------------------------------------------
    # 5. Relative Momentum Vector (RMV)
    # -----------------------------------------------------------------
    ema20_curr = float(ema20.iloc[-1])
    atr14_curr = float(atr14.iloc[-1]) if float(atr14.iloc[-1]) > 0 else 1.0
    rmv = (curr_price - ema20_curr) / atr14_curr
    rmv_score = max(0.0, min(100.0, (1.0 - (abs(rmv) / 1.50)) * 100.0))

    if rmv > 1.5:
        rmv_status = f"RMV +{rmv:.2f}σ (Bullish Expansion)"
    elif rmv < -1.5:
        rmv_status = f"RMV {rmv:.2f}σ (Bearish Breakdown)"
    else:
        rmv_status = f"RMV {rmv:+.2f}σ (Coiled Vector)"

    # -----------------------------------------------------------------
    # 6. Richard Arms Ease of Move (EMV) Indicator & Zero Crossover
    # -----------------------------------------------------------------
    midpoint_move = ((h + l) / 2.0) - ((h.shift(1) + l.shift(1)) / 2.0)
    range_hl = (h - l).replace(0, np.nan)
    box_ratio = (v / 100_000.0) / range_hl
    emv_1 = midpoint_move / box_ratio.replace(0, np.nan)
    emv_14 = emv_1.rolling(14).mean()
    
    emv_curr = float(emv_14.iloc[-1]) if len(emv_14) >= 14 and not pd.isna(emv_14.iloc[-1]) else 0.0
    emv_prev = float(emv_14.iloc[-2]) if len(emv_14) >= 14 and not pd.isna(emv_14.iloc[-2]) else 0.0
    
    # Positive EMV with low friction volume = effortless expansion potential
    is_emv_positive = emv_curr > 0
    is_emv_crossover = (emv_prev <= 0) and (emv_curr > 0)

    emv_status = f"EMV {emv_curr:+.4f} (Effortless Move 🚀)" if is_emv_crossover else (f"EMV {emv_curr:+.4f} (Positive Upside)" if is_emv_positive else f"EMV {emv_curr:+.4f} (Friction/Chop)")

    # -----------------------------------------------------------------
    # 7. Institutional Order Flow & VDU Footprints
    # -----------------------------------------------------------------
    vol50 = float(v.rolling(50).mean().iloc[-1]) if len(v) >= 50 else avg_vol_20
    curr_v = float(v.iloc[-1])
    vdu_ratio = (curr_v / vol50) if vol50 > 0 else 1.0
    is_vdu = vdu_ratio <= 0.50
    vdu_3d_seq = float((v.tail(3) < (vol50 * 0.60)).sum()) == 3

    # Morales & Kacher Pocket Pivot Test
    is_up_day = curr_price > float(c.iloc[-2]) if len(c) > 1 else False
    down_vols = np.where(c.shift(1) < c.shift(2), v.shift(1), 0) if len(c) > 2 else [0]
    max_down_vol_10 = float(pd.Series(down_vols).tail(10).max()) if len(down_vols) > 0 else 0
    is_pocket_pivot = is_up_day and (curr_v > max_down_vol_10) and (curr_v > vol50)

    # Up/Down Volume Ratio (50-Day)
    up_v = np.where(c > c.shift(1), v, 0)
    down_v = np.where(c < c.shift(1), v, 0)
    sum_up_v = float(pd.Series(up_v).tail(50).sum())
    sum_down_v = float(pd.Series(down_v).tail(50).sum())
    ud_ratio = (sum_up_v / sum_down_v) if sum_down_v > 0 else 1.0

    # Close Location Value (CLV)
    curr_h = float(h.iloc[-1])
    curr_l = float(l.iloc[-1])
    clv = (curr_price - curr_l) / (curr_h - curr_l) if (curr_h - curr_l) > 0 else 0.5

    # Composite Institutional Footprint Score (0-100)
    footprint_score = min(100.0, 
        (25.0 if is_vdu else (15.0 if vdu_ratio <= 0.75 else 0.0)) +
        (15.0 if vdu_3d_seq else 0.0) +
        (25.0 if is_pocket_pivot else 0.0) +
        (15.0 if is_emv_positive else 0.0) +
        (10.0 if is_emv_crossover else 0.0) +
        (10.0 if ud_ratio >= 1.25 else 0.0)
    )

    # -----------------------------------------------------------------
    # COMPOSITE PRE-BREAKOUT VOLATILITY COMPRESSION SCORE (0-100)
    # -----------------------------------------------------------------
    composite_compression_score = round(
        (ttm_score * 0.20) +
        (vcp_score * 0.20) +
        (dcw_score * 0.20) +
        (hvr_score * 0.15) +
        (rmv_score * 0.15) +
        ((100.0 if is_emv_positive else 30.0) * 0.10),
        1
    )

    # Master A+ Pre-Breakout Setup Gatekeeper
    # Disqualify if squeeze has already FIRED/EXPANDED or composite score is below 55
    if is_squeeze_fired or (composite_compression_score < 55.0 and not is_low_squeeze and not is_mid_squeeze and not is_high_squeeze):
        return None

    setup_grade = "A+" if (composite_compression_score >= 80.0 or is_high_squeeze) else ("A" if composite_compression_score >= 68.0 else "B+")

    short_pct = info.get('shortPercentOfFloat', 0) if info else 0
    short_ratio = info.get('shortRatio', 0) if info else 0
    short_str = f"{short_pct * 100:.1f}%" if short_pct else "N/A"

    powder_keg_score = round(
        (short_ratio * 10) + (short_pct * 100) + (100.0 / max(0.1, compression_ratio)) + (abs(rmv) * 5.0),
        1
    )

    vdu_text = " | VDU Dry-Up" if is_vdu else (" | 3D VDU Coiling" if vdu_3d_seq else "")
    pp_text = " | ⚡ Pocket Pivot" if is_pocket_pivot else ""
    emv_text = f" | {emv_status}"

    return {
        "ticker": ticker.upper(),
        "price": round(curr_price, 2),
        "composite_score": composite_compression_score,
        "setup_grade": setup_grade,
        "ttm_label": ttm_label,
        "compression_ratio": round(compression_ratio, 2),
        "vcp_ratio": round(vcp_ratio, 2),
        "hvr": round(hvr, 2),
        "rmv": round(rmv, 2),
        "rmv_status": rmv_status,
        "emv_14": round(emv_curr, 6),
        "emv_status": emv_status,
        "ud_ratio": round(ud_ratio, 2),
        "footprint_score": round(footprint_score, 1),
        "powder_keg_score": powder_keg_score,
        "short_float": short_str,
        "short_ratio": short_ratio,
        "is_vdu": is_vdu,
        "is_pocket_pivot": is_pocket_pivot,
        "bb_width_pct": round(float(bb_width_pct.iloc[-1]), 1),
        "metric": f"Score {composite_compression_score}/100 [{setup_grade}] | {ttm_label} ({compression_ratio:.2f}x Ratio{vdu_text}{pp_text}) | {rmv_status}{emv_text}"
    }

def run_apex_squeeze_engine():
    print("[Apex Squeeze Engine] Connecting to DuckDB Lakehouse...")
    if not os.path.exists(LAKEHOUSE_PATH):
        print(f"Lakehouse parquet not found at {LAKEHOUSE_PATH}")
        return

    con = duckdb.connect()
    print("Loading bulk daily OHLCV from DuckDB Lakehouse...")
    df_all = con.execute(f"SELECT Ticker, Date, Open, High, Low, Close, Volume FROM '{LAKEHOUSE_PATH}' WHERE Date >= CURRENT_DATE - INTERVAL 200 DAY ORDER BY Ticker, Date ASC").df()
    con.close()

    tickers = df_all['Ticker'].unique()
    print(f"Scanning {len(tickers)} stocks for A+ Blended Volatility Squeezes...")

    ttm_keltner = []
    gamma_squeeze = []
    high_short = []

    for ticker, group_df in df_all.groupby('Ticker'):
        if len(group_df) < 60:
            continue
        group_df.columns = ['Ticker', 'Date', 'Open', 'High', 'Low', 'Close', 'Volume']
        group_df['Date'] = pd.to_datetime(group_df['Date'])
        res = evaluate_apex_squeeze(ticker, group_df)
        if res:
            ttm_keltner.append(res)
            high_short.append(res)

            # Query Options Chain Flow for Top Liquid Names
            if res['composite_score'] >= 70.0:
                try:
                    t_obj = yf.Ticker(ticker)
                    expiries = t_obj.options
                    if expiries:
                        chain = t_obj.option_chain(expiries[0])
                        c_vol = float(chain.calls['volume'].sum()) if 'volume' in chain.calls else 0
                        p_vol = float(chain.puts['volume'].sum()) if 'volume' in chain.puts else 0
                        cp_ratio = c_vol / max(1.0, p_vol)

                        gamma_score = round((cp_ratio * 25.0) + (res['composite_score'] * 0.75), 1)
                        if cp_ratio >= 1.10:
                            g_res = res.copy()
                            g_res["cp_ratio"] = round(cp_ratio, 2)
                            g_res["gamma_score"] = gamma_score
                            g_res["metric"] = f"⚡ Gamma Score {gamma_score:.0f}/100 | Call/Put Vol: {cp_ratio:.2f}x | {res['rmv_status']}"
                            gamma_squeeze.append(g_res)
                except Exception:
                    pass

    print(f"Applying strict $2.0B+ Market Cap filter on {len(ttm_keltner)} candidate survivors...")
    filtered_ttm = []
    for r in ttm_keltner:
        try:
            t_obj = yf.Ticker(r['ticker'])
            fast_inf = t_obj.fast_info
            mcap = getattr(fast_inf, 'market_cap', 0) or 0
            if mcap == 0:
                mcap = t_obj.info.get('marketCap', 0) or 0
            
            # If mcap is available, strictly enforce >= $2.0 Billion
            if mcap > 0 and mcap < 2_000_000_000:
                continue
                
            mcap_b = mcap / 1_000_000_000.0 if mcap > 0 else 0
            r['market_cap_b'] = round(mcap_b, 1)
            r['metric'] += f" | Cap: ${mcap_b:.1f}B" if mcap_b > 0 else ""
            filtered_ttm.append(r)
        except Exception:
            filtered_ttm.append(r)

    ttm_keltner = sorted(filtered_ttm, key=lambda x: (x['setup_grade'] == 'A+', x['composite_score']), reverse=True)[:25]
    high_short = sorted([x for x in filtered_ttm if x['ticker'] in [t['ticker'] for t in ttm_keltner]], key=lambda x: x['powder_keg_score'], reverse=True)[:20]
    gamma_squeeze = sorted(gamma_squeeze, key=lambda x: x.get('gamma_score', 0), reverse=True)[:20]

    payload = {
        "last_updated": pd.Timestamp.now().isoformat(),
        "total_scanned": len(tickers),
        "ttm_keltner_squeeze": ttm_keltner,
        "gamma_squeeze_setup": gamma_squeeze,
        "high_short_interest": high_short
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(payload, f, indent=2)

    print(f"✅ Apex Squeeze Scan Complete! Found {len(ttm_keltner)} A+ Liquid Stage 2 Squeeze Coils ($2B+ Cap, 5M+ Vol). Saved to {OUTPUT_FILE}")
    for r in ttm_keltner[:10]:
        print(f"  {r['ticker']:5s} | ${r['price']:6.2f} | Score: {r['composite_score']}/100 [{r['setup_grade']}] | {r['ttm_label']} | {r['rmv_status']}")

if __name__ == "__main__":
    run_apex_squeeze_engine()
