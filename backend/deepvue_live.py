import yfinance as yf
import pandas as pd
from datetime import datetime
import pytz

def evaluate_deepvue_breakout(ticker):
    """
    Monitors a DeepVue Leader for an intraday S.N.I.P breakout.
    Focuses heavily on Volume Run-Rate (pacing) and breaking the previous day high.
    Returns a dictionary with status and data if triggered, else None.
    """
    try:
        t = yf.Ticker(ticker)
        
        # 1. Fetch Daily Data for Average Daily Volume (ADV) and Previous High
        daily_hist = t.history(period="1mo", interval="1d")
        if len(daily_hist) < 5: return None
        
        adv = daily_hist['Volume'][-21:-1].mean() # 20-day average volume
        prev_high = daily_hist['High'].iloc[-2]
        
        # 2. Fetch Intraday Data for current pacing
        intra_hist = t.history(period="1d", interval="5m")
        if intra_hist.empty: return None
        
        current_price = intra_hist['Close'].iloc[-1]
        current_day_volume = intra_hist['Volume'].sum()
        
        # 3. Calculate Run-Rate Pacing
        # Regular market hours: 9:30 AM to 4:00 PM EST (390 minutes)
        est = pytz.timezone('US/Eastern')
        now_est = datetime.now(est)
        
        # Calculate minutes elapsed since open
        open_time = now_est.replace(hour=9, minute=30, second=0, microsecond=0)
        minutes_elapsed = (now_est - open_time).total_seconds() / 60.0
        
        if minutes_elapsed <= 0:
            return None # Pre-market
        
        if minutes_elapsed > 390:
            minutes_elapsed = 390 # After hours cap
            
        elapsed_ratio = minutes_elapsed / 390.0
        
        # Expected volume at this time of day
        expected_volume = adv * elapsed_ratio
        
        # Run-Rate Multiplier (How much faster is it trading compared to normal?)
        run_rate_multiplier = current_day_volume / max(1, expected_volume)
        
        # 4. DeepVue Action Triggers
        # Trigger if trading > 1.5x normal pacing AND breaking previous day high
        is_breakout = current_price > prev_high
        is_volume_surge = run_rate_multiplier > 1.5
        
        if is_breakout and is_volume_surge:
            return {
                "status": "TRIGGERED",
                "ticker": ticker,
                "price": current_price,
                "prev_high": prev_high,
                "run_rate_multiplier": round(run_rate_multiplier, 2),
                "volume_pct_of_adv": round((current_day_volume / max(1, adv)) * 100, 1)
            }
            
        return None
        
    except Exception as e:
        print(f"[DeepVue Live] Error analyzing {ticker}: {e}")
        return None

if __name__ == "__main__":
    # Test block
    res = evaluate_deepvue_breakout("ARM")
    print(res)
