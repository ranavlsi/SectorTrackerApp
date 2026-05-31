import yfinance as yf
import pandas as pd
import numpy as np

def evaluate_pead_setup(ticker):
    """
    Evaluates a stock against the Post-Earnings Announcement Drift (PEAD) strategy.
    Tracks a rolling 3-week window for an initial massive Earnings Pump,
    then looks for a low-volume pullback to a moving average, followed by a secondary breakout.
    """
    try:
        t = yf.Ticker(ticker)
        # Fetch 2 months to ensure we have enough data for 30-day ADV + 21-day rolling window
        df = t.history(period="3mo", interval="1d")
        if len(df) < 50: return None
        
        df['ADV_30'] = df['Volume'].rolling(window=30).mean()
        
        # 1. Rolling 3-Week Window Scan for the Earnings Pump Catalyst
        # Look back over the last 21 trading days (excluding today)
        recent_history = df.iloc[-22:-1]
        
        pump_date = None
        pump_open = 0
        
        for idx in range(1, len(recent_history)):
            prev_close = recent_history['Close'].iloc[idx-1]
            curr_open = recent_history['Open'].iloc[idx]
            curr_vol = recent_history['Volume'].iloc[idx]
            adv = recent_history['ADV_30'].iloc[idx]
            
            gap_pct = (curr_open / prev_close) - 1
            vol_mult = curr_vol / adv if adv > 0 else 0
            
            # Did it gap > 10% on > 3x average volume?
            if gap_pct >= 0.10 and vol_mult >= 3.0:
                pump_date = recent_history.index[idx]
                pump_open = curr_open
                break # Found the most recent catalyst
                
        if not pump_date:
            return None # No PEAD catalyst in the 3-week window
            
        # 2. Verify the Gap hasn't been filled (Must stay above the gap open)
        post_pump_history = df.loc[pump_date:]
        if post_pump_history['Low'].min() < (pump_open * 0.95): # 5% leeway
            return None # Gap was filled, setup invalidated
            
        # 3. Pullback to Moving Average Check
        df['EMA_10'] = df['Close'].ewm(span=10, adjust=False).mean()
        df['SMA_20'] = df['Close'].rolling(window=20).mean()
        
        prev_close = df['Close'].iloc[-2]
        ema_10 = df['EMA_10'].iloc[-2]
        sma_20 = df['SMA_20'].iloc[-2]
        
        dist_10 = abs((prev_close - ema_10) / ema_10)
        dist_20 = abs((prev_close - sma_20) / sma_20)
        
        if dist_10 > 0.02 and dist_20 > 0.02:
            return None # Not touching dynamic support
            
        # 4. Declining Volume on Pullback
        rvol_yesterday = df['Volume'].iloc[-2] / df['ADV_30'].iloc[-2]
        if rvol_yesterday > 1.0:
            return None # Selling pressure is too high
            
        # 5. Secondary Breakout Trigger (Current price > Yesterday's High)
        intra = t.history(period="1d", interval="5m")
        if intra.empty: return None
        
        curr_price = intra['Close'].iloc[-1]
        prev_high = df['High'].iloc[-2]
        
        if curr_price > prev_high:
            days_since_pump = len(post_pump_history) - 1
            return {
                "status": "TRIGGERED",
                "ticker": ticker,
                "price": round(curr_price, 2),
                "breakout_level": round(prev_high, 2),
                "days_since_pump": days_since_pump,
                "support_level": "10-EMA" if dist_10 <= dist_20 else "20-SMA"
            }
            
        return None

    except Exception as e:
        print(f"[PEAD Engine] Error analyzing {ticker}: {e}")
        return None

if __name__ == "__main__":
    res = evaluate_pead_setup("RDDT") # RDDT recently had massive earnings gap
    print("RDDT:", res)
