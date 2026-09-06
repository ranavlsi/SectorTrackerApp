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
            # If high == low, put it in the closest bin
            idx = np.digitize([l], bin_edges)[0] - 1
            idx = max(0, min(idx, bins-1))
            profile[idx] += v
        else:
            # Distribute volume proportionally across bins spanning the high-low range
            # Find bins that overlap with [l, h]
            start_idx = np.digitize([l], bin_edges)[0] - 1
            end_idx = np.digitize([h], bin_edges)[0] - 1
            
            start_idx = max(0, min(start_idx, bins-1))
            end_idx = max(0, min(end_idx, bins-1))
            
            if start_idx == end_idx:
                profile[start_idx] += v
            else:
                vol_per_bin = v / (end_idx - start_idx + 1)
                profile[start_idx:end_idx+1] += vol_per_bin
                
    # Find POC
    poc_idx = np.argmax(profile)
    poc_price = (bin_edges[poc_idx] + bin_edges[poc_idx+1]) / 2.0
    
    # Calculate Value Area
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
    
    return {
        "poc": poc_price,
        "val": val,
        "vah": vah
    }

def evaluate_val_rejection(ticker, df=None, lookback=63):
    """
    Identifies stocks that are rejecting (bouncing off) the Quarterly Value Area Low.
    Returns separate messages for Rolling Quarter and Fixed Quarter.
    """
    try:
        if df is None or len(df) < lookback:
            return None
            
        msg_rolling = None
        msg_fixed = None
        curr_close = df['Close'].iloc[-1]
        
        # --- 1. Rolling Quarter (63 Days) ---
        recent_df = df.iloc[-lookback:].copy()
        vp_rolling = calculate_volume_profile(recent_df, bins=100, va_pct=0.70)
        
        if vp_rolling:
            val_rolling = vp_rolling['val']
            last_3 = recent_df.iloc[-3:]
            touched_val = any(last_3['Low'] <= (val_rolling * 1.005))
            bouncing = curr_close > (val_rolling * 1.015) and curr_close < (val_rolling * 1.08)
            
            if touched_val and bouncing:
                dist = ((curr_close - val_rolling) / val_rolling) * 100
                msg_rolling = f"Bouncing +{dist:.1f}% off ${val_rolling:.2f}"

        # --- 2. Fixed Quarter (Since start of current calendar quarter) ---
        if 'Date' in df.columns:
            last_date = pd.to_datetime(df['Date'].iloc[-1])
            quarter = (last_date.month - 1) // 3 + 1
            start_month = 3 * quarter - 2
            start_of_quarter = pd.Timestamp(year=last_date.year, month=start_month, day=1)
            
            fixed_df = df[df['Date'] >= start_of_quarter].copy()
            if len(fixed_df) >= 15: # Only run if we are at least 15 days into the quarter
                vp_fixed = calculate_volume_profile(fixed_df, bins=100, va_pct=0.70)
                if vp_fixed:
                    val_fixed = vp_fixed['val']
                    last_3_fixed = fixed_df.iloc[-3:]
                    touched_val_fixed = any(last_3_fixed['Low'] <= (val_fixed * 1.005))
                    bouncing_fixed = curr_close > (val_fixed * 1.015) and curr_close < (val_fixed * 1.08)
                    
                    if touched_val_fixed and bouncing_fixed:
                        dist_f = ((curr_close - val_fixed) / val_fixed) * 100
                        msg_fixed = f"Bouncing +{dist_f:.1f}% off ${val_fixed:.2f} (Q{quarter})"

        if msg_rolling or msg_fixed:
            return {
                "rolling_message": msg_rolling,
                "fixed_message": msg_fixed
            }
            
        return None
        
    except Exception as e:
        return None
