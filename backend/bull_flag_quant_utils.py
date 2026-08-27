import pandas as pd
import numpy as np
from scipy.stats import linregress

def score_bull_flag_pole(df, start_idx, end_idx, baseline_lookback=20):
    """
    Quantifies the strength and quality of a bull flag pole.
    Returns composite score incorporating velocity, R-squared, and ATR expansion.
    """
    pole_data = df.iloc[start_idx : end_idx + 1]
    baseline_start = max(0, start_idx - baseline_lookback)
    baseline_data = df.iloc[baseline_start : start_idx]
    
    bars = len(pole_data)
    if bars < 2: return None
        
    p_start = pole_data['Close'].iloc[0]
    p_end = pole_data['Close'].iloc[-1]
    if p_start <= 0: return None
    
    pole_return = (p_end - p_start) / p_start
    if pole_return <= 0: return None
    
    velocity = pole_return / bars 
    
    y = (pole_data['Close'] / p_start).values
    x = np.arange(bars)
    
    try:
        slope, intercept, r_value, p_value, std_err = linregress(x, y)
        r_squared = r_value ** 2
    except:
        r_squared = 0
    
    high_low = baseline_data['High'] - baseline_data['Low']
    high_close = np.abs(baseline_data['High'] - baseline_data['Close'].shift(1))
    low_close = np.abs(baseline_data['Low'] - baseline_data['Close'].shift(1))
    
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    baseline_atr = tr.mean()
    
    pole_height_abs = p_end - pole_data['Low'].min()
    atr_expansion = pole_height_abs / baseline_atr if baseline_atr > 0 else 0
    
    composite_score = (velocity * 100) * (r_squared ** 2) * atr_expansion
    
    return {
        'Return': pole_return,
        'Bars': bars,
        'Velocity': velocity,
        'R_Squared': r_squared,
        'ATR_Expansion': atr_expansion,
        'Score': composite_score
    }

def validate_bull_flag_channel(highs, lows, closes):
    """
    Validates the downward drift and structure of the flag using Linear Regression.
    """
    if len(highs) < 2: 
        return {"is_valid_flag": False, "metrics": {}}
        
    x = np.arange(len(highs))
    
    try:
        m_h, c_h, r_h, p_h, std_h = linregress(x, highs)
        m_l, c_l, r_l, p_l, std_l = linregress(x, lows)
        m_c, c_c, r_c, p_c, std_c = linregress(x, closes)
    except:
        return {"is_valid_flag": False, "metrics": {}}
        
    avg_price = np.mean(closes)
    
    # Strictly negative slopes or very flat
    is_drifting_down = m_h <= 0.01 and m_l <= 0.01
    
    # Parallelism: Difference between slopes relative to price
    parallelism = abs(m_h - m_l) / avg_price if avg_price > 0 else 1.0
    is_parallel = parallelism < 0.01
    
    # Volatility / Smoothness
    r2_closes = r_c ** 2
    volatility_ratio_see = std_c / avg_price if avg_price > 0 else 1.0
    is_orderly = r2_closes > 0.4 and volatility_ratio_see < 0.02
    
    is_valid = is_drifting_down and is_parallel and is_orderly
    
    return {
        "is_valid_flag": is_valid,
        "metrics": {
            "slope_high": m_h,
            "slope_low": m_l,
            "parallelism": parallelism,
            "r2_closes": r2_closes,
            "volatility_ratio_see": volatility_ratio_see
        }
    }

def verify_bull_flag_volume(df, pole_start_idx, pole_high_idx, current_idx):
    """
    Verifies that volume dries up during consolidation and checks if price holds the POC.
    """
    if current_idx - pole_high_idx < 1: 
        return {"holding_above_poc": False, "volume_drop_ratio": 1.0, "poc_price": 0.0}
        
    pole_df = df.iloc[pole_start_idx : pole_high_idx + 1]
    flag_df = df.iloc[pole_high_idx + 1 : current_idx + 1]
    
    if len(flag_df) < 1 or len(pole_df) < 1:
        return {"holding_above_poc": False, "volume_drop_ratio": 1.0, "poc_price": 0.0}
        
    # Calculate POC of the Pole
    tick = 0.5 # 50 cent bins
    binned_prices = (pole_df['Close'] / tick).round() * tick
    volume_by_price = pole_df.groupby(binned_prices)['Volume'].sum()
    poc_price = volume_by_price.idxmax() if not volume_by_price.empty else pole_df['Close'].median()
    
    # Check if flag holds above POC (allow 1% tolerance)
    lowest_close = flag_df['Close'].min()
    holding_above_poc = lowest_close >= (poc_price * 0.99)
    
    # Verify volume drop
    avg_pole_vol = pole_df['Volume'].mean()
    avg_flag_vol = flag_df['Volume'].mean()
    
    volume_drop_ratio = avg_flag_vol / avg_pole_vol if avg_pole_vol > 0 else 1.0
    
    return {
        "holding_above_poc": holding_above_poc,
        "volume_drop_ratio": volume_drop_ratio,
        "poc_price": poc_price
    }

def get_dynamic_pullback_limit(pole_pct):
    pole_anchors = [0.10, 0.15, 0.30, 0.50]
    fib_anchors = [0.236, 0.382, 0.500, 0.618]
    dynamic_fib = np.interp(pole_pct, pole_anchors, fib_anchors)
    return dynamic_fib

def evaluate_bull_flag_fib(base_price, peak_price, current_low):
    if base_price <= 0: return {"is_valid": False}
    
    pole_height = peak_price - base_price
    pole_pct = pole_height / base_price
    if pole_pct <= 0: return {"is_valid": False}
    
    max_fib_level = get_dynamic_pullback_limit(pole_pct)
    max_allowable_pullback_price = peak_price - (pole_height * max_fib_level)
    equivalent_drawdown_pct = (peak_price - max_allowable_pullback_price) / peak_price
    is_valid = current_low >= (max_allowable_pullback_price * 0.995) # 0.5% buffer
    
    return {
        "pole_pct": pole_pct,
        "max_fib_level": max_fib_level,
        "min_allowable_price": max_allowable_pullback_price,
        "equivalent_drawdown_pct": equivalent_drawdown_pct,
        "is_valid": is_valid
    }

def calculate_early_flag_entries(df, pole_lookback=20, ema_period=5):
    """
    Dynamically anchors VWAP to the pole high and calculates fast EMA for early entries.
    """
    df = df.copy()
    df['EMA_Fast'] = df['Close'].ewm(span=ema_period, adjust=False).mean()
    df['early_entry_ema'] = False
    df['early_entry_avwap'] = False
    
    # Calculate AVWAP anchored to the pole high
    # Find local max in last 20 days
    peak_idx = df['High'].iloc[-pole_lookback:].idxmax()
    if pd.isna(peak_idx): return df
    
    mask = df.index >= peak_idx
    df_anchor = df[mask].copy()
    
    if len(df_anchor) > 1:
        df_anchor['Typical_Price'] = (df_anchor['High'] + df_anchor['Low'] + df_anchor['Close']) / 3
        df_anchor['Cum_Vol_Price'] = (df_anchor['Typical_Price'] * df_anchor['Volume']).cumsum()
        df_anchor['Cum_Vol'] = df_anchor['Volume'].cumsum()
        
        avwap = df_anchor['Cum_Vol_Price'] / df_anchor['Cum_Vol']
        df.loc[mask, 'AVWAP_Peak'] = avwap
        
        # Check today for early entry triggers
        today = df.iloc[-1]
        yesterday = df.iloc[-2]
        
        if 'AVWAP_Peak' in df.columns and not pd.isna(today['AVWAP_Peak']):
            if yesterday['Close'] < yesterday['AVWAP_Peak'] and today['Close'] > today['AVWAP_Peak']:
                df.at[df.index[-1], 'early_entry_avwap'] = True
                
        if yesterday['Close'] < yesterday['EMA_Fast'] and today['Close'] > today['EMA_Fast']:
            df.at[df.index[-1], 'early_entry_ema'] = True
            
    return df
