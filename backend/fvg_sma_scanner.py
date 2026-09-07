import pandas as pd
import numpy as np

def evaluate_fvg_sma_confluence(ticker, df):
    """
    Scans for stocks where price is pulling back into a recent Bullish Fair Value Gap (FVG)
    that also perfectly aligns with a key Simple Moving Average (10, 20, or 50).
    """
    try:
        if df is None or len(df) < 55:
            return None
            
        close = df['Close']
        high = df['High']
        low = df['Low']
        
        sma10 = close.rolling(10).mean().iloc[-1]
        sma20 = close.rolling(20).mean().iloc[-1]
        sma50 = close.rolling(50).mean().iloc[-1]
        
        curr_low = low.iloc[-1]
        curr_close = close.iloc[-1]
        
        # Lookback for recent FVGs (last 20 days)
        # We need at least 3 candles to form an FVG.
        # Candle sequence: i-2 (pre-gap), i-1 (expansion), i (post-gap)
        # For a Bullish FVG: low[i] > high[i-2]. The gap is between high[i-2] and low[i].
        
        recent_fvg = None
        
        # We start from -21 to -1 to find if an FVG was formed recently.
        for i in range(-21, -1):
            c_post_low = low.iloc[i]
            c_pre_high = high.iloc[i-2]
            
            if c_post_low > c_pre_high:
                # We found a Bullish FVG!
                gap_bottom = c_pre_high
                gap_top = c_post_low
                gap_size_pct = ((gap_top - gap_bottom) / gap_bottom) * 100
                
                # We want a meaningful gap, e.g., > 0.5%
                if gap_size_pct > 0.5:
                    recent_fvg = (gap_bottom, gap_top)
                    # We continue the loop so we grab the most recent valid FVG
        
        if not recent_fvg:
            return None
            
        gap_bottom, gap_top = recent_fvg
        
        # 1. Price Retracement: Is current price testing the gap?
        # Current low dipped into or near the gap, and close is holding around or above it.
        testing_gap = (curr_low <= gap_top * 1.01) and (curr_close >= gap_bottom * 0.99)
        
        if not testing_gap:
            return None
            
        # 2. SMA Confluence: Does a key SMA sit inside or right near the gap?
        confluent_sma = None
        smas = {'10-day': sma10, '20-day': sma20, '50-day': sma50}
        
        for name, val in smas.items():
            if val >= gap_bottom * 0.99 and val <= gap_top * 1.01:
                confluent_sma = name
                break
                
        if confluent_sma:
            return {
                "ticker": ticker,
                "metric": f"FVG Support (${gap_bottom:.2f}-${gap_top:.2f}) + {confluent_sma} SMA Confluence"
            }
            
        return None
        
    except Exception as e:
        return None
