import duckdb
import pandas as pd
import numpy as np
from scipy.signal import argrelextrema

def identify_true_vcp(hist):
    if len(hist) < 60:
        return False
        
    closes = hist['Close'].values
    highs = hist['High'].values
    lows = hist['Low'].values
    vols = hist['Volume'].values
    
    # 1. Find the major pivot high in the last 40 days (Left side of base)
    recent_40 = hist.iloc[-40:]
    pivot_idx_local = recent_40['High'].argmax()
    pivot_high = recent_40['High'].iloc[pivot_idx_local]
    
    # Ensure the pivot wasn't formed just yesterday (need time to form a base)
    days_since_pivot = 40 - pivot_idx_local
    if days_since_pivot < 10:
        return False
        
    # 2. Base Depth
    base_low = recent_40['Low'].iloc[pivot_idx_local:].min()
    base_depth = (pivot_high - base_low) / pivot_high
    
    if base_depth > 0.35 or base_depth < 0.08:
        # Base is too deep (>35%) or not a real base (<8%)
        return False
        
    # 3. Current tightness near the pivot (The Right Side)
    current_price = closes[-1]
    
    # Must be approaching the pivot high (within 10%)
    if current_price < pivot_high * 0.90 or current_price > pivot_high * 1.02:
        return False
        
    # 4. Volatility Contraction (ATR / BBW)
    tr1 = hist['High'] - hist['Low']
    tr2 = abs(hist['High'] - hist['Close'].shift(1))
    tr3 = abs(hist['Low'] - hist['Close'].shift(1))
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    # ATR is dropping over the base
    atr_20 = tr.rolling(20).mean().iloc[-1]
    atr_5 = tr.rolling(5).mean().iloc[-1]
    if atr_5 > atr_20 * 0.7:
        return False # Volatility hasn't contracted enough on the right side
        
    # 5. Volume Dry up on the right side
    avg_vol_50 = hist['Volume'].rolling(50).mean().iloc[-1]
    recent_5_vol = hist['Volume'].iloc[-5:].mean()
    
    if recent_5_vol > avg_vol_50 * 0.8:
        return False # Volume must be extremely quiet (drying up) on the right side
        
    return True

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()
grouped = df.groupby('Ticker')

vcp_stocks = []
for ticker, group in grouped:
    try:
        hist = group.set_index('Date')
        if hist['Close'].iloc[-1] < 10: continue
        avg_vol = hist['Volume'].rolling(20).mean().iloc[-1]
        if avg_vol * hist['Close'].iloc[-1] < 5000000: continue
        
        if identify_true_vcp(hist):
            vcp_stocks.append(ticker)
    except:
        pass
        
print(f"Found {len(vcp_stocks)} True VCP setups: {vcp_stocks}")

