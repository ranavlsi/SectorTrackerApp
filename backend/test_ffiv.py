import pandas as pd
import yfinance as yf
import numpy as np

def calculate_atr(df, period):
    high_low = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close = np.abs(df['Low'] - df['Close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    return true_range.rolling(period).mean()

ticker = 'FFIV'
df = yf.download(ticker, period="2y", interval="1d", progress=False)
if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.get_level_values(0)

df['SMA_50'] = df['Close'].rolling(window=50).mean()
df['SMA_200'] = df['Close'].rolling(window=200).mean()
df['ATR_10'] = calculate_atr(df, 10)
df['ATR_50'] = calculate_atr(df, 50)
df['ADV_50'] = df['Volume'].rolling(window=50).mean()
df['Close'] = df['Close'].ffill()

current_close = df['Close'].iloc[-1]
sma_50_current = df['SMA_50'].iloc[-1]
sma_200_current = df['SMA_200'].iloc[-1]
sma_200_21d_ago = df['SMA_200'].iloc[-22]

print(f"Current Close: {current_close}, SMA50: {sma_50_current}, SMA200: {sma_200_current}, SMA200 21d ago: {sma_200_21d_ago}")
if current_close < sma_50_current or current_close < sma_200_current: print("Failed: Under MAs")
if sma_50_current < sma_200_current: print("Failed: SMA50 < SMA200")
if sma_200_current < sma_200_21d_ago: print("Failed: SMA200 declining")

timeframes = [63, 126, 252, 378, 500]
for lookback_target in timeframes:
    lookback = min(len(df), lookback_target)
    if lookback < 63: continue
    print(f"\n--- Testing {lookback} days ({lookback/21:.1f} months) ---")
    base_df = df.iloc[-lookback:].copy()
    current_volume = base_df['Volume'].iloc[-1]
    
    base_high = base_df['High'].max()
    base_low = base_df['Low'].min()
    
    if base_df['Volume'].mean() < 100000 or current_close < 3.0: print("Failed volume/price"); continue
    
    base_high_idx = base_df['High'].idxmax()
    pos = base_df.index.get_loc(base_high_idx)
    days_since_high = len(base_df) - pos
    
    print(f"Base High: {base_high}, Days Since High: {days_since_high}")
    if days_since_high < max(21, int(lookback * 0.33)):
        print("Failed: Left side of cup too recent")
        continue
        
    actual_base_length_months = max(2, round(days_since_high / 21))
    base_drawdown = (base_high - base_low) / base_high
    max_allowed_drawdown = 0.30 if actual_base_length_months < 6 else 0.40
    print(f"Drawdown: {base_drawdown:.1%} (Max Allowed: {max_allowed_drawdown:.1%})")
    
    if base_drawdown > max_allowed_drawdown:
        print("Failed: Drawdown too deep")
        continue
        
    base_range = base_high - base_low
    right_side_range = base_df['High'].iloc[-10:].max() - base_df['Low'].iloc[-10:].min()
    if base_range > 0 and (right_side_range / base_range) >= 0.40:
        print(f"Failed: Right side too loose ({right_side_range/base_range:.1%})")
        continue
        
    last_10_days = base_df.iloc[-10:]
    days_under_75pct_vol = (last_10_days['Volume'] < (0.75 * last_10_days['ADV_50'])).sum()
    if days_under_75pct_vol < 2:
        print(f"Failed: No absolute dry up ({days_under_75pct_vol} < 2)")
        continue
        
    last_50_days = base_df.iloc[-50:]
    up_days_vol = last_50_days[last_50_days['Close'] > last_50_days['Open']]['Volume'].sum()
    down_days_vol = last_50_days[last_50_days['Close'] < last_50_days['Open']]['Volume'].sum()
    ud_ratio = 999.0 if down_days_vol == 0 else up_days_vol / down_days_vol
    
    if ud_ratio < 1.05:
        print(f"Failed: U/D ratio {ud_ratio:.2f} < 1.05")
        continue
        
    is_about_to_breakout = (current_close >= base_high * 0.85) and (current_close <= base_high)
    if is_about_to_breakout:
        print("SUCCESS! About to breakout!")
    else:
        print("Failed: Price not close enough to base high")

