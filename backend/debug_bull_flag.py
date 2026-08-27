import pandas as pd
import yfinance as yf
from bull_flag_scanner import detect_bull_flag
from bull_flag_quant_utils import (
    score_bull_flag_pole,
    validate_bull_flag_channel,
    verify_bull_flag_volume,
    evaluate_bull_flag_fib,
    calculate_early_flag_entries
)

def debug_ticker(ticker):
    print(f"\n--- Debugging {ticker} ---")
    df = yf.download(ticker, period='6mo', progress=False)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    
    if len(df) < 50:
        print("Not enough data")
        return
        
    df = df.copy()
    df.reset_index(drop=True, inplace=True)
    df = calculate_early_flag_entries(df, pole_lookback=20, ema_period=5)
    
    pole_high_val = df['High'].iloc[-20:].max()
    pole_high_idx = df['High'].iloc[-20:].idxmax()
    print(f"Pole High Idx: {pole_high_idx} (Len: {len(df)})")
    
    if pole_high_idx > len(df) - 4:
        print("Failed: Pole high too recent (needs 3 days of flag)")
        return
        
    pole_search_start = max(0, pole_high_idx - 20)
    if pole_search_start >= pole_high_idx:
        print("Failed: search start >= high idx")
        return
        
    pole_base_val = df['Low'].iloc[pole_search_start:pole_high_idx].min()
    pole_base_idx = df['Low'].iloc[pole_search_start:pole_high_idx].idxmin()
    
    if pd.isna(pole_base_idx):
        print("Failed: Pole base is NaN")
        return
        
    pole_metrics = score_bull_flag_pole(df, pole_base_idx, pole_high_idx, baseline_lookback=20)
    print(f"Pole Metrics: {pole_metrics}")
    if not pole_metrics or pole_metrics['Score'] < 2.0:
        print("Failed: Pole score < 2.0")
        return
        
    flag_start_idx = pole_high_idx + 1
    flag_end_idx = len(df) - 2
    if flag_end_idx - flag_start_idx < 2:
        print("Failed: Flag too short")
        return
        
    flag_df = df.iloc[flag_start_idx : flag_end_idx + 1]
    channel_metrics = validate_bull_flag_channel(flag_df['High'].values, flag_df['Low'].values, flag_df['Close'].values)
    print(f"Channel Metrics: {channel_metrics}")
    
    if not channel_metrics['is_valid_flag'] and channel_metrics['metrics'].get('volatility_ratio_see', 1) > 0.05:
        print("Failed: Invalid flag channel & high volatility")
        return
        
    current_low = flag_df['Low'].min()
    fib_metrics = evaluate_bull_flag_fib(pole_base_val, pole_high_val, current_low)
    print(f"Fib Metrics: {fib_metrics}")
    
    if not fib_metrics['is_valid']:
        print("Failed: Fib metrics invalid")
        return
        
    vol_metrics = verify_bull_flag_volume(df, pole_base_idx, pole_high_idx, flag_end_idx)
    print(f"Volume Metrics: {vol_metrics}")
    
    if not vol_metrics['holding_above_poc']:
        print("Failed: Not holding above POC")
        return
        
    print("Passed all filters!")
    print("Final output:", detect_bull_flag(ticker, df))

tickers = ['NVDA', 'ARM', 'PLTR', 'CRWD', 'SMCI', 'TSLA', 'AAPL', 'MSTR']
for t in tickers:
    debug_ticker(t)
