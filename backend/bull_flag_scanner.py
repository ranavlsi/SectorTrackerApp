import pandas as pd
import numpy as np

def detect_bull_flag(ticker, df):
    """
    Detects a Bull Flag using Institutional Quant Models:
    - Pole Velocity Scoring
    - Linear Regression Channel Validation
    - Dynamic Fibonacci Drawdowns
    - Volume Profile POC
    - AVWAP Early Entries
    """
    if len(df) < 50:
        return {"status": "none"}
        
    # Work on a copy with integer index for easy slicing
    df = df.copy()
    df.reset_index(drop=True, inplace=True)
    
    try:
        from bull_flag_quant_utils import (
            score_bull_flag_pole,
            validate_bull_flag_channel,
            verify_bull_flag_volume,
            evaluate_bull_flag_fib,
            calculate_early_flag_entries
        )
    except ImportError:
        return {"status": "none"}
        
    # Pre-calculate AVWAP triggers
    df = calculate_early_flag_entries(df, pole_lookback=20, ema_period=5)
    
    # 1. Identify the Pole Peak
    pole_high_val = df['High'].iloc[-20:].max()
    pole_high_idx = df['High'].iloc[-20:].idxmax()
    
    # Flag must be at least 3 days old
    if pole_high_idx > len(df) - 4:
        return {"status": "none"}
        
    # 2. Identify the Pole Base
    pole_search_start = max(0, pole_high_idx - 20)
    if pole_search_start >= pole_high_idx: return {"status": "none"}
    
    pole_base_val = df['Low'].iloc[pole_search_start:pole_high_idx].min()
    pole_base_idx = df['Low'].iloc[pole_search_start:pole_high_idx].idxmin()
    
    if pd.isna(pole_base_idx): return {"status": "none"}
    
    # 3. Score the Pole (Velocity, R2, ATR Expansion)
    pole_metrics = score_bull_flag_pole(df, pole_base_idx, pole_high_idx, baseline_lookback=20)
    if not pole_metrics or pole_metrics['Score'] < 2.0: # Minimum acceptable institutional thrust
        return {"status": "none"}
        
    # 4. Flag Channel Analyst
    flag_start_idx = pole_high_idx + 1
    flag_end_idx = len(df) - 2 # flag up to yesterday
    
    if flag_end_idx - flag_start_idx < 2: return {"status": "none"}
    
    flag_df = df.iloc[flag_start_idx : flag_end_idx + 1]
    channel_metrics = validate_bull_flag_channel(flag_df['High'].values, flag_df['Low'].values, flag_df['Close'].values)
    
    # We allow the flag even if the channel isn't perfectly parallel, as long as it's not a volatile distribution
    # We will score it lower if it's messy. But if it strictly failed, we drop it.
    if not channel_metrics['is_valid_flag'] and channel_metrics['metrics'].get('volatility_ratio_see', 1) > 0.05:
        return {"status": "none"}
        
    # 5. Dynamic Fibonacci Pullback
    current_low = flag_df['Low'].min()
    fib_metrics = evaluate_bull_flag_fib(pole_base_val, pole_high_val, current_low)
    
    if not fib_metrics['is_valid']:
        return {"status": "none"}
        
    # 6. Volume Profile (POC)
    vol_metrics = verify_bull_flag_volume(df, pole_base_idx, pole_high_idx, flag_end_idx)
    
    if not vol_metrics['holding_above_poc']:
        return {"status": "none"}
        
    # 7. Breakout Triggers (Today)
    today_row = df.iloc[-1]
    
    # AVWAP Early Entry
    is_early_entry = today_row.get('early_entry_avwap', False) or today_row.get('early_entry_ema', False)
    
    # Traditional Breakout
    avg_v_20 = df['Volume'].iloc[-21:-1].mean()
    is_traditional_breakout = today_row['Close'] > pole_high_val and today_row['Volume'] > avg_v_20 * 1.5
    
    is_pending = not (is_early_entry or is_traditional_breakout)
    
    if is_early_entry:
        status_str = "early_entry"
    elif is_traditional_breakout:
        status_str = "triggered"
    else:
        status_str = "pending"
        
    # 8. Composite Scoring
    channel_r2 = channel_metrics['metrics'].get('r2_closes', 0.1)
    vol_drop = max(0.1, 2.0 - vol_metrics['volume_drop_ratio'])
    total_score = pole_metrics['Score'] * (channel_r2 + 0.5) * vol_drop
    
    avg_v_20 = df['Volume'].iloc[-21:-1].mean()
    rvol = today_row['Volume'] / avg_v_20 if avg_v_20 > 0 else 1.0
    
    return {
        "status": status_str,
        "score": round(total_score, 1),
        "details": {
            "rvol": round(rvol, 1),
            "pole_rally_pct": round(pole_metrics['Return'] * 100, 1),
            "pole_velocity": f"{pole_metrics['Velocity']*100:.1f}%/bar",
            "flag_duration": f"{len(flag_df)} Days",
            "dynamic_fib_limit": f"{fib_metrics['max_fib_level']:.3f}",
            "volume_poc": round(vol_metrics['poc_price'], 2),
            "breakout_price": round(today_row['Close'], 2) if not is_pending else round(pole_high_val, 2)
        }
    }
