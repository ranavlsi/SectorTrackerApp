import numpy as np
import pandas as pd

def calculate_volume_profile(df, bins=100, va_pct=0.70):
    min_price = df['Low'].min()
    max_price = df['High'].max()
    
    if max_price == min_price:
        return None
        
    bin_edges = np.linspace(min_price, max_price, bins + 1)
    profile = np.zeros(bins)
    
    # Distribute volume
    for _, row in df.iterrows():
        l = row['Low']
        h = row['High']
        v = row['Volume']
        if h == l:
            idx = np.digitize([l], bin_edges)[0] - 1
            idx = max(0, min(idx, bins-1))
            profile[idx] += v
        else:
            start_idx = np.digitize([l], bin_edges)[0] - 1
            end_idx = np.digitize([h], bin_edges)[0] - 1
            start_idx = max(0, min(start_idx, bins-1))
            end_idx = max(0, min(end_idx, bins-1))
            if start_idx == end_idx:
                profile[start_idx] += v
            else:
                vol_per_bin = v / (end_idx - start_idx + 1)
                profile[start_idx:end_idx+1] += vol_per_bin
                
    poc_idx = np.argmax(profile)
    poc_price = (bin_edges[poc_idx] + bin_edges[poc_idx+1]) / 2.0
    
    total_vol = np.sum(profile)
    target_vol = total_vol * va_pct
    current_vol = profile[poc_idx]
    lower_idx = poc_idx
    upper_idx = poc_idx
    
    while current_vol < target_vol and (lower_idx > 0 or upper_idx < bins - 1):
        vol_below = profile[lower_idx - 1] if lower_idx > 0 else 0
        vol_above = profile[upper_idx + 1] if upper_idx < bins - 1 else 0
        if vol_below >= vol_above and lower_idx > 0:
            lower_idx -= 1
            current_vol += profile[lower_idx]
        elif vol_above > vol_below and upper_idx < bins - 1:
            upper_idx += 1
            current_vol += profile[upper_idx]
        elif lower_idx > 0:
            lower_idx -= 1
            current_vol += profile[lower_idx]
        elif upper_idx < bins - 1:
            upper_idx += 1
            current_vol += profile[upper_idx]
            
    val = bin_edges[lower_idx]
    vah = bin_edges[upper_idx+1]
    return {"poc": poc_price, "val": val, "vah": vah}

def evaluate_level_bounce(level, df_slice, curr_c, curr_o, curr_l, curr_h, level_name):
    """
    Checks if a stock pulled back from above and is experiencing a bullish rejection off the key volume profile level.
    """
    if not level or level <= 0:
        return None
        
    last_3 = df_slice.iloc[-3:]
    prior_20 = df_slice.iloc[-20:]
    
    # 1. Price came from above this level (prior peak clearly above)
    was_above = prior_20['High'].max() >= level * 1.015
    if not was_above:
        return None
        
    # 2. Tested level: low dipped into or right around the level (-1.5% to +1.0%)
    tested_level = any((last_3['Low'] <= level * 1.01) & (last_3['Low'] >= level * 0.985))
    if not tested_level:
        return None
        
    # 3. Holding & Bouncing: Close must be holding at/above level and not extended (> +5.0%)
    holding = curr_c >= level * 0.998 and curr_c <= level * 1.055
    if not holding:
        return None
        
    # 4. Candlestick Confirmation:
    # Closed green OR printed a bottom wick (close in upper 45% of day's range)
    candle_range = curr_h - curr_l
    close_in_upper = (curr_c - curr_l) >= (candle_range * 0.45) if candle_range > 0 else True
    green_or_wick = (curr_c >= curr_o * 0.995) or close_in_upper
    if not green_or_wick:
        return None
        
    dist = ((curr_c - level) / level) * 100
    score = round(100.0 - dist, 1)
    return {
        "dist": dist,
        "score": score,
        "level": round(float(level), 2),
        "message": f"Bouncing +{dist:.1f}% off {level_name} ${level:.2f}"
    }

def evaluate_val_rejection(ticker, df=None, lookback=63):
    """
    Legacy wrapper retained for backwards compatibility.
    Evaluates rolling and fixed VAL rejections.
    """
    res = evaluate_volume_profile_rejections(ticker, df=df, lookback=lookback)
    if not res:
        return None
    val_data = res.get("val")
    if not val_data:
        return None
    return {
        "rolling_message": val_data.get("rolling_message"),
        "fixed_message": val_data.get("fixed_message")
    }

def evaluate_volume_profile_rejections(ticker, df=None, lookback=63):
    """
    Scans for bullish pullback rejections off all 3 key volume profile anchors:
    1. VAH (Value Area High) - Institutional expansion support test
    2. POC (Point of Control) - Fair value high-volume node support test
    3. VAL (Value Area Low) - Deep value discount support test
    Supports both 63-day Rolling and YTD Fixed Calendar Quarter profiles.
    """
    try:
        if df is None or len(df) < lookback:
            return None
            
        curr_close = df['Close'].iloc[-1]
        curr_open = df['Open'].iloc[-1]
        curr_low = df['Low'].iloc[-1]
        curr_high = df['High'].iloc[-1]
        
        # --- 1. Rolling Quarter (63 Days) ---
        recent_df = df.iloc[-lookback:].copy()
        vp_rolling = calculate_volume_profile(recent_df, bins=100, va_pct=0.70)
        
        out = {
            "vah": None,
            "poc": None,
            "val": None
        }
        
        if vp_rolling:
            vah_roll = evaluate_level_bounce(vp_rolling['vah'], recent_df, curr_close, curr_open, curr_low, curr_high, "VAH")
            if vah_roll:
                out["vah"] = {"metric": vah_roll["message"], "score": vah_roll["score"], "level": vah_roll["level"]}
                
            poc_roll = evaluate_level_bounce(vp_rolling['poc'], recent_df, curr_close, curr_open, curr_low, curr_high, "POC")
            if poc_roll:
                out["poc"] = {"metric": poc_roll["message"], "score": poc_roll["score"], "level": poc_roll["level"]}
                
            # VAL Rolling (specialized logic)
            val_rolling = vp_rolling['val']
            last_3 = recent_df.iloc[-3:]
            touched_val = any(last_3['Low'] <= (val_rolling * 1.005))
            bouncing_val = curr_close > (val_rolling * 1.015) and curr_close < (val_rolling * 1.08)
            if touched_val and bouncing_val:
                dist_val = ((curr_close - val_rolling) / val_rolling) * 100
                out["val"] = {
                    "rolling_message": f"Bouncing +{dist_val:.1f}% off ${val_rolling:.2f}",
                    "score": round(100.0 - dist_val, 1)
                }

        # --- 2. Fixed Calendar Quarter ---
        date_series = df.index if (df.index.name == 'Date' or isinstance(df.index, pd.DatetimeIndex)) else df.get('Date')
        
        if date_series is not None and len(date_series) > 0:
            last_date = pd.to_datetime(date_series[-1])
            quarter = (last_date.month - 1) // 3 + 1
            start_month = 3 * quarter - 2
            start_of_quarter = pd.Timestamp(year=last_date.year, month=start_month, day=1)
            
            mask = pd.to_datetime(date_series) >= start_of_quarter
            fixed_df = df[mask].copy()
            if len(fixed_df) >= 15:
                vp_fixed = calculate_volume_profile(fixed_df, bins=100, va_pct=0.70)
                if vp_fixed:
                    val_fixed = vp_fixed['val']
                    last_3_fixed = fixed_df.iloc[-3:]
                    touched_val_fixed = any(last_3_fixed['Low'] <= (val_fixed * 1.005))
                    bouncing_fixed = curr_close > (val_fixed * 1.015) and curr_close < (val_fixed * 1.08)
                    if touched_val_fixed and bouncing_fixed:
                        dist_f = ((curr_close - val_fixed) / val_fixed) * 100
                        if out["val"] is None:
                            out["val"] = {}
                        out["val"]["fixed_message"] = f"Bouncing +{dist_f:.1f}% off ${val_fixed:.2f} (Q{quarter})"

        if out["vah"] or out["poc"] or out["val"]:
            return out
            
        return None
    except Exception as e:
        return None
