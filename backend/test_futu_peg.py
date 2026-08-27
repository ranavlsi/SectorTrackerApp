import yfinance as yf
import pandas as pd
from datetime import datetime

t = yf.Ticker('FUTU')
df = t.history(period="100d")
close = df['Close']
open_s = df['Open']
vol = df['Volume']
low = df['Low']
high = df['High']
curr_c = close.iloc[-1]

avg_vol_50 = vol.iloc[-70:-20].mean()

for i in range(-20, -1):
    prev_c = close.iloc[i-1]
    day_o = open_s.iloc[i]
    day_c = close.iloc[i]
    day_v = vol.iloc[i]
    
    if day_o > prev_c * 1.04 and day_v > avg_vol_50 * 2.5 and day_c >= day_o * 0.99:
        gap_pct = ((day_o/prev_c)-1)*100
        days_since = abs(i) - 1
        print(f"--- GAP TRIGGERED ---")
        print(f"Date: {df.index[i]}")
        print(f"Prev Close: {prev_c:.2f}, Open: {day_o:.2f}, Close: {day_c:.2f}")
        print(f"Gap: {gap_pct:.2f}%")
        print(f"Volume: {day_v}, Avg Vol: {avg_vol_50:.0f}, Ratio: {day_v/avg_vol_50:.2f}")
        
        if days_since > 5:
            gap_low = low.iloc[i]
            flag_high = high.iloc[i+1:-1].max() if days_since > 1 else high.iloc[i]
            
            print(f"--- CONSOLIDATION LOGIC ---")
            print(f"Days Since Gap: {days_since} (Needs > 5)")
            print(f"Current Price: {curr_c:.2f}")
            print(f"Gap Low: {gap_low:.2f} (Current must be > Gap Low: {curr_c > gap_low})")
            print(f"Max High Since Gap: {high.iloc[i:].max():.2f} (Must be < Gap Day Close * 1.10 [{day_c * 1.10:.2f}]: {high.iloc[i:].max() < day_c * 1.10})")
            print(f"Flag High: {flag_high:.2f} (Current must be <= Flag High * 1.01 [{flag_high * 1.01:.2f}]: {curr_c <= flag_high * 1.01})")
            
            if curr_c > gap_low and high.iloc[i:].max() < day_c * 1.10 and curr_c <= flag_high * 1.01:
                print(">>> FULLY QUALIFIED FOR CONSOLIDATION <<<")

