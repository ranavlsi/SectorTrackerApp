import yfinance as yf
import pandas as pd
import numpy as np

def evaluate_qullamaggie_setup(ticker, pre_df=None):
    """
    Evaluates a stock against Kristjan Kullamägi's quantitative breakout rules.
    Checks for >4% ADR, a massive historical run (HTF), tight moving average surfing,
    and a low-volume consolidation followed by an intraday breakout.
    """
    try:
        if pre_df is not None:
            df = pre_df.copy()
        else:
            from yahooquery import Ticker as YQTicker
            t = YQTicker(ticker)
            df = t.history(period="3mo", interval="1d")
            if df is None or df.empty or ticker.lower() not in df.index.get_level_values(0).str.lower(): return None
            df = df.loc[ticker.lower() if ticker.lower() in df.index.levels[0] else ticker].reset_index()
            df.rename(columns={'close':'Close', 'high':'High', 'low':'Low', 'open':'Open', 'volume':'Volume'}, inplace=True)
            
        if len(df) < 40: return None
        
        # 1. Calculate ADR (Average Daily Range) over 20 days
        df['Daily_Range_Pct'] = (df['High'] - df['Low']) / df['Close'].shift(1)
        adr_20 = df['Daily_Range_Pct'].rolling(window=20).mean().iloc[-2] * 100
        
        if adr_20 < 4.0:
            return None # Not volatile enough for Qullamaggie
            
        # 2. HTF / Prior Move Detection (must have rallied > 50% in last 40 days)
        last_40_days = df.iloc[-41:-1] # Exclude today
        min_close_40d = last_40_days['Close'].min()
        max_close_40d = last_40_days['Close'].max()
        
        if (max_close_40d / min_close_40d) - 1 < 0.50:
            return None # No massive prior run
            
        # 3. Moving Averages
        df['SMA_10'] = df['Close'].rolling(window=10).mean()
        df['SMA_20'] = df['Close'].rolling(window=20).mean()
        
        # 4. Consolidation & "Surfing" Check (Price must be tight to SMA)
        prev_close = df['Close'].iloc[-2]
        sma_10 = df['SMA_10'].iloc[-2]
        sma_20 = df['SMA_20'].iloc[-2]
        
        # Check if previous close is within 3% of the 10 or 20 SMA
        dist_10 = abs((prev_close - sma_10) / sma_10)
        dist_20 = abs((prev_close - sma_20) / sma_20)
        
        is_surfing = (dist_10 <= 0.03) or (dist_20 <= 0.03)
        if not is_surfing:
            return None
            
        # 5. Volume Dry-Up Check
        df['ADV_20'] = df['Volume'].rolling(window=20).mean()
        # Require multiple days of volume dry-up and price tightness
        recent_vol_avg = df['Volume'].iloc[-4:-1].mean()
        if recent_vol_avg > df['ADV_20'].iloc[-2] * 0.75:
            return None
            
        # Price tightness over the last 3 days
        recent_range = df['High'].iloc[-4:-1].max() - df['Low'].iloc[-4:-1].min()
        if recent_range > (df['Close'].iloc[-2] * 0.05): # Range must be tight (< 5%)
            return None
            
        # 6. Intraday Breakout Trigger (Current price > yesterday's high)
        # BYPASSED for Master Scanner speed: 
        # If it's coiled and surfing, it's a valid pending setup!
        
        curr_price = df['Close'].iloc[-1]
        prev_high = df['High'].iloc[-2]
        
        if curr_price > prev_high:
            status = "TRIGGERED"
        else:
            status = "PENDING"
            
        return {
            "status": status,
            "ticker": ticker,
            "adr": round(adr_20, 1),
            "price": round(curr_price, 2),
            "breakout_level": round(prev_high, 2),
            "sma_support": "10-Day" if dist_10 <= dist_20 else "20-Day"
        }


    except Exception as e:
        print(f"[Qullamaggie Engine] Error analyzing {ticker}: {e}")
        return None

if __name__ == "__main__":
    res = evaluate_qullamaggie_setup("ARM")
    print("ARM:", res)
