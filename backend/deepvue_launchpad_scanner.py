import numpy as np
import pandas as pd

def detect_pocket_pivot(df, lookback=10):
    """
    Pocket Pivot Detection (Dr. Chris Kacher & Gil Morales):
    Checks if in the last `lookback` sessions, an up-day's volume was greater than
    the maximum down-day volume of the prior 10 days while resting on/near key moving averages.
    """
    try:
        if len(df) < lookback + 10:
            return False, 0
            
        close = df['Close']
        vol = df['Volume']
        ema10 = close.ewm(span=10, adjust=False).mean()
        ema21 = close.ewm(span=21, adjust=False).mean()
        sma50 = close.rolling(50).mean()
        
        for i in range(-lookback, 0):
            # Must be an up day
            if close.iloc[i] > close.iloc[i-1]:
                curr_v = vol.iloc[i]
                # Prior 10 days down volume
                prev_10_c = close.iloc[i-10:i]
                prev_10_v = vol.iloc[i-10:i]
                down_vols = [prev_10_v.iloc[k] for k in range(1, len(prev_10_c)) if prev_10_c.iloc[k] < prev_10_c.iloc[k-1]]
                
                max_down_v = max(down_vols) if down_vols else 0
                if curr_v > max_down_v and max_down_v > 0:
                    # Must be near 10 EMA, 21 EMA, or 50 SMA (within 2.5%)
                    c_val = close.iloc[i]
                    near_ma = (
                        abs(c_val - ema10.iloc[i]) / c_val < 0.025 or
                        abs(c_val - ema21.iloc[i]) / c_val < 0.025 or
                        abs(c_val - sma50.iloc[i]) / c_val < 0.025
                    )
                    if near_ma:
                        days_ago = abs(i)
                        return True, days_ago
        return False, 0
    except Exception:
        return False, 0

def detect_rs_new_high(df, spy_series=None):
    """
    DeepVue RS Line New High:
    Checks if the stock's Relative Strength line (Price / SPY) is at or within 0.5%
    of its 20-day high while price is consolidating on the pad.
    """
    try:
        close = df['Close']
        if spy_series is not None and not spy_series.empty:
            aligned_spy = spy_series.reindex(close.index).ffill()
            rs_line = close / aligned_spy
        else:
            # Fallback: internal momentum acceleration
            rs_line = close / close.rolling(50).mean()
            
        if len(rs_line) >= 20:
            rs_20d_max = rs_line.iloc[-20:].max()
            curr_rs = rs_line.iloc[-1]
            if curr_rs >= rs_20d_max * 0.995:
                return True
        return False
    except Exception:
        return False

def evaluate_deepvue_launchpad(ticker, df=None, spy_series=None):
    """
    TraderLion / Deepvue Launchpad Scanner (Upgraded Dynamic Execution Engine):
    1. Moving Average Convergence ("The Pinch"):
       - Bundle A (Fast): 10-day EMA, 21-day EMA, and 50-day SMA.
       - Bundle B (Standard): 21-day SMA, 50-day SMA, and 65-day EMA.
       - Pinched if either bundle spread is <= 5.5% (dynamically adjusted for high-volatility Leaders).
    2. Price Proximity to the Pad:
       - Price is within <= 5.0% of the MA bundle average floor.
    3. Volume Dry-Up (VDU):
       - Current volume or recent 3-day average volume <= 90% of 50-day average.
    4. Stage 2 / Trend Alignment:
       - 6-month prior run >= 15% and price >= 200 SMA * 0.95 (or > 50-day SMA).
    5. Actionable Tactical States:
       - 🚀 LAUNCHING: Price breaching the 3-day high pivot on expanding volume (vol_ratio >= 0.80).
       - 🔵 DNB PIVOT: Low-volume down session followed by tight inside/narrow range bar.
       - 🟡 COILING: Resting tight on pad on dry volume waiting for entry pivot.
    """
    try:
        if df is None or len(df) < 50:
            return None
            
        close = df['Close']
        high = df['High']
        low = df['Low']
        open_s = df['Open']
        vol = df['Volume']
        
        curr_c = float(close.iloc[-1])
        curr_h = float(high.iloc[-1])
        curr_l = float(low.iloc[-1])
        curr_v = float(vol.iloc[-1])
        
        # Exclude penny stocks below $5
        if curr_c < 5.0:
            return None
            
        # Moving Averages
        ema10 = float(close.ewm(span=10, adjust=False).mean().iloc[-1])
        ema21 = float(close.ewm(span=21, adjust=False).mean().iloc[-1])
        sma21 = float(close.rolling(21).mean().iloc[-1])
        sma50 = float(close.rolling(50).mean().iloc[-1])
        ema65 = float(close.ewm(span=65, adjust=False).mean().iloc[-1])
        
        if any(np.isnan([ema10, ema21, sma21, sma50, ema65])):
            return None

        # Bundle A: Fast (10 EMA, 21 EMA, 50 SMA)
        ma_min_a = min(ema10, ema21, sma50)
        ma_max_a = max(ema10, ema21, sma50)
        ma_avg_a = (ema10 + ema21 + sma50) / 3.0
        spread_a = ((ma_max_a - ma_min_a) / ma_avg_a) * 100

        # Bundle B: Standard (21 SMA, 50 SMA, 65 EMA)
        ma_min_b = min(sma21, sma50, ema65)
        ma_max_b = max(sma21, sma50, ema65)
        ma_avg_b = (sma21 + sma50 + ema65) / 3.0
        spread_b = ((ma_max_b - ma_min_b) / ma_avg_b) * 100

        # Use the best pinched MA bundle
        if spread_a <= spread_b:
            ma_spread_pct = spread_a
            ma_avg = ma_avg_a
            ma_min = ma_min_a
            bundle_name = "Fast (10/21/50)"
        else:
            ma_spread_pct = spread_b
            ma_avg = ma_avg_b
            ma_min = ma_min_b
            bundle_name = "Std (21/50/65)"

        # Max allowed spread (5.5%)
        if ma_spread_pct > 5.5:
            return None

        # Price Proximity to the Pad (within 5.0% of MA bundle, and not collapsing below 4% of floor)
        price_dist_pct = round(abs(curr_c - ma_avg) / ma_avg * 100, 2)
        if price_dist_pct > 5.0 or curr_c < (ma_min * 0.96):
            return None

        # Macro Trend Alignment
        if len(close) >= 200:
            sma200 = float(close.rolling(200).mean().iloc[-1])
            if curr_c < (sma200 * 0.94):
                return None

        lookback_bars = min(len(close), 130)
        prior_low = float(low.iloc[-lookback_bars:-15].min())
        prior_high = float(high.iloc[-lookback_bars:].max())
        prior_run_pct = ((prior_high - prior_low) / prior_low) * 100 if prior_low > 0 else 0
        if prior_run_pct < 15.0:
            return None

        # Volume & Exhaustion Checks (ADV >= 10M shares)
        avg_vol50 = float(vol.iloc[-50:].mean()) if len(vol) >= 50 else float(vol.mean())
        if avg_vol50 < 10_000_000:
            return None

        vol_ratio = curr_v / avg_vol50
        recent_3d_vol_ratio = float(vol.iloc[-3:].mean()) / avg_vol50

        # Allow Launching stocks or VDU coiling stocks (<= 92% vol)
        has_vdu = (vol_ratio <= 0.92) or (recent_3d_vol_ratio <= 0.95)

        # Volatility & ATR Contraction
        tr = pd.concat([
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs()
        ], axis=1).max(axis=1)
        atr14 = float(tr.rolling(14).mean().iloc[-1]) if len(tr) >= 14 else (curr_h - curr_l)
        today_range = curr_h - curr_l
        range_tightness = (today_range / atr14) if atr14 > 0 else 1.0

        # Entry Pivot: 3-day high prior to today
        entry_pivot = round(float(high.iloc[-4:-1].max()) if len(high) >= 4 else float(high.iloc[-2]), 2)
        stop_loss = round(ma_min * 0.98, 2)
        risk_pct = round(((curr_c - stop_loss) / curr_c) * 100, 1) if curr_c > stop_loss else 2.0

        # State 1: LAUNCHING (Breaching 3-day pivot today on volume)
        is_launching = (curr_c >= entry_pivot * 0.995 or curr_h >= entry_pivot) and (vol_ratio >= 0.75)

        # State 2: DNB PIVOT (Down-Narrow-Breakout / Coiled Ready)
        # Authentic Minervini / TraderLion Rule:
        # Prior day was down on light volume, and today MUST be an Inside Bar (High <= High[-1] and Low >= Low[-1]) 
        # with ATR range contraction (<= 0.85 * ATR14).
        is_dnb = False
        if len(close) >= 4:
            prior_day_down = (close.iloc[-2] < close.iloc[-3]) and (vol.iloc[-2] <= avg_vol50 * 0.92)
            is_inside_bar = (curr_h <= float(high.iloc[-2]) * 1.002) and (curr_l >= float(low.iloc[-2]) * 0.998)
            is_narrow_range = (today_range <= atr14 * 0.85)
            if prior_day_down and is_inside_bar and is_narrow_range:
                is_dnb = True

        if not (has_vdu or is_launching or is_dnb):
            return None

        if is_launching:
            state = "LAUNCHING"
            state_label = "🚀 LAUNCHING"
            state_color = "#10b981"
        elif is_dnb:
            state = "DNB"
            state_label = "🔵 DNB PIVOT"
            state_color = "#3b82f6"
        else:
            state = "COILING"
            state_label = "🟡 COILING"
            state_color = "#fbbf24"

        # Confluence Badges
        has_pocket_pivot, pp_days_ago = detect_pocket_pivot(df, lookback=10)
        has_rs_high = detect_rs_new_high(df, spy_series=spy_series)

        # Quantitative Scoring
        pinch_bonus = max(0, (5.5 - ma_spread_pct) * 4.0)
        vdu_bonus = max(0, (1.0 - min(vol_ratio, recent_3d_vol_ratio)) * 15.0)
        range_bonus = max(0, (1.2 - min(range_tightness, 1.2)) * 8.0)
        state_bonus = 25.0 if state == "LAUNCHING" else (15.0 if state == "DNB" else 5.0)
        pp_bonus = 12.0 if has_pocket_pivot else 0.0
        rs_bonus = 10.0 if has_rs_high else 0.0

        score = 80.0 + pinch_bonus + vdu_bonus + range_bonus + state_bonus + pp_bonus + rs_bonus

        badges = [state_label]
        if has_pocket_pivot:
            badges.append(f"⚡ Pocket Pivot ({pp_days_ago}d ago)")
        if has_rs_high:
            badges.append("🔥 RS High")

        badge_str = " | ".join(badges)
        vdu_pct_str = f"-{int((1.0 - vol_ratio) * 100)}%" if vol_ratio < 1.0 else f"+{int((vol_ratio - 1.0) * 100)}%"
        metric_str = f"{badge_str} · MA Pinch {ma_spread_pct:.1f}% · VDU {vdu_pct_str} · Risk {risk_pct}%"

        return {
            "ticker": ticker,
            "metric": metric_str,
            "score": round(float(score), 1),
            "price": round(float(curr_c), 2),
            "state": state,
            "state_label": state_label,
            "state_color": state_color,
            "has_pocket_pivot": has_pocket_pivot,
            "has_rs_high": has_rs_high,
            "ma_spread_pct": ma_spread_pct,
            "sma21": round(sma21, 2),
            "sma50": round(sma50, 2),
            "ema65": round(ema65, 2),
            "vol_ratio": round(vol_ratio, 2),
            "entry_pivot": entry_pivot,
            "stop_loss": stop_loss,
            "risk_pct": risk_pct
        }
    except Exception as e:
        return None
