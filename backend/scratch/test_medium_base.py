import sys
sys.path.append("/Users/amitkumar/Desktop/SectorTrackerApp/backend")
from long_base_scanner import evaluate_medium_base
import duckdb

lakehouse_path = "/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet"
lake_df = duckdb.query(f"SELECT * FROM read_parquet('{lakehouse_path}') ORDER BY Date").to_df()
grouped = lake_df.groupby('Ticker')

count = 0
passed = 0
fail_reasons = {'depth': 0, 'sma50': 0, 'not_coiled': 0, 'distance': 0, 'no_history': 0}

for ticker in grouped.groups.keys():
    if count >= 1000:
        break
    count += 1
    
    df = grouped.get_group(ticker).set_index('Date').dropna()
    if len(df) < 63:
        fail_reasons['no_history'] += 1
        continue
        
    df['SMA_50'] = df['Close'].rolling(window=50).mean()
    df['SMA_200'] = df['Close'].rolling(window=200).mean()
    
    # Calculate ATR manually for speed in test
    high_low = df['High'] - df['Low']
    high_close = (df['High'] - df['Close'].shift()).abs()
    low_close = (df['Low'] - df['Close'].shift()).abs()
    import pandas as pd
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = ranges.max(axis=1)
    df['ATR_10'] = true_range.rolling(10).mean()
    df['ATR_50'] = true_range.rolling(50).mean()
    df['ADV_50'] = df['Volume'].rolling(window=50).mean()
    
    timeframes = [63, 126, 252, 378, 500]
    
    ticker_passed = False
    
    for lookback_target in timeframes:
        lookback = min(len(df), lookback_target)
        if lookback < 63: continue
            
        base_df = df.iloc[-lookback:]
        current_close = base_df['Close'].iloc[-1]
        current_volume = base_df['Volume'].iloc[-1]
        
        base_high = base_df['High'].max()
        base_low = base_df['Low'].min()
        
        if base_low < (base_high * 0.65):
            fail_reasons['depth'] += 1
            continue
            
        sma_50_current = base_df['SMA_50'].iloc[-1]
        if current_close < sma_50_current:
            fail_reasons['sma50'] += 1
            continue
            
        atr_10 = base_df['ATR_10'].iloc[-1]
        atr_50 = base_df['ATR_50'].iloc[-1]
        is_coiled = atr_10 < (atr_50 * 0.60)
        
        adv_10 = base_df['Volume'].rolling(window=10).mean().iloc[-1]
        adv_50 = base_df['Volume'].rolling(window=50).mean().iloc[-1]
        is_vol_coiled = adv_10 < (adv_50 * 0.85)
        
        is_coiled_both = is_coiled and is_vol_coiled
        
        if not is_coiled_both:
            fail_reasons['not_coiled'] += 1
            continue
            
        is_about_to_breakout = (current_close >= base_high * 0.90) and (current_close <= base_high) and is_coiled_both
        is_confirmed_breakout = (current_close > base_high) and (current_volume >= base_df['ADV_50'].iloc[-1] * 1.50)
        
        if is_about_to_breakout or is_confirmed_breakout:
            ticker_passed = True
            break
        else:
            fail_reasons['distance'] += 1
            
    if ticker_passed:
        passed += 1
        print(f"Passed: {ticker}")

print(f"Tested {count} stocks.")
print(f"Passed: {passed}")
print(f"Fail Reasons Breakdown:")
for k, v in fail_reasons.items():
    print(f"  {k}: {v}")
