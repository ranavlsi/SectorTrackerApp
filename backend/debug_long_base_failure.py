import sys
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
import duckdb
import pandas as pd
import numpy as np

def calculate_atr(df, period):
    high_low = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close = np.abs(df['Low'] - df['Close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    return true_range.rolling(period).mean()

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()

rejection_reasons = {
    "len < 400": 0,
    "days_since_high < 252": 0,
    "base_low < base_high * 0.65 (drawdown > 35%)": 0,
    "current_close < sma_200 or sma_200 falling": 0,
    "not is_confirmed_breakout and not is_about_to_breakout": 0,
    "passed": 0
}

sample_count = 0
passed_tickers = []

for ticker, group in df.groupby('Ticker'):
    group = group.set_index('Date')
    if len(group) < 400:
        rejection_reasons["len < 400"] += 1
        continue
    
    sample_count += 1
    df_t = group.copy()
    df_t['SMA_200'] = df_t['Close'].rolling(window=200).mean()
    df_t['ATR_10'] = calculate_atr(df_t, 10)
    df_t['ATR_50'] = calculate_atr(df_t, 50)
    df_t['ADV_50'] = df_t['Volume'].rolling(window=50).mean()
    
    lookback = min(len(df_t), 750)
    base_df = df_t.iloc[-lookback:]
    current_close = base_df['Close'].iloc[-1]
    current_volume = base_df['Volume'].iloc[-1]
    
    historical_base = base_df.iloc[:-5]
    base_high = historical_base['High'].max()
    base_low = base_df['Low'].min()
    
    base_high_idx = historical_base['High'].idxmax()
    try:
        pos = historical_base.index.get_loc(base_high_idx)
        if isinstance(pos, slice) or isinstance(pos, np.ndarray):
            pos = pos[0] if isinstance(pos, np.ndarray) else pos.start
    except KeyError:
        continue
        
    days_since_high = len(historical_base) - pos
    if days_since_high < 252:
        rejection_reasons["days_since_high < 252"] += 1
        continue
        
    if base_low < (base_high * 0.65):
        rejection_reasons["base_low < base_high * 0.65 (drawdown > 35%)"] += 1
        continue
        
    sma_200_current = base_df['SMA_200'].iloc[-1]
    sma_200_past = base_df['SMA_200'].iloc[-20]
    if current_close < sma_200_current or sma_200_current < sma_200_past:
        rejection_reasons["current_close < sma_200 or sma_200 falling"] += 1
        continue
        
    atr_10 = base_df['ATR_10'].iloc[-1]
    atr_50 = base_df['ATR_50'].iloc[-1]
    is_coiled = atr_10 < (atr_50 * 0.5)
    
    adv_10 = base_df['Volume'].rolling(window=10).mean().iloc[-1]
    adv_50 = base_df['Volume'].rolling(window=50).mean().iloc[-1]
    is_vol_coiled = adv_10 < (adv_50 * 0.75)
    is_coiled = is_coiled and is_vol_coiled
    
    is_about_to_breakout = (current_close >= base_high * 0.90) and (current_close <= base_high) and is_coiled
    is_confirmed_breakout = (current_close > base_high) and (current_volume >= base_df['ADV_50'].iloc[-1] * 1.50)
    
    if is_confirmed_breakout or is_about_to_breakout:
        rejection_reasons["passed"] += 1
        passed_tickers.append(ticker)
    else:
        rejection_reasons["not is_confirmed_breakout and not is_about_to_breakout"] += 1

print(f"Total tickers with >= 400 rows: {sample_count}")
print("Rejection summary:")
for k, v in rejection_reasons.items():
    print(f"  {k}: {v}")

