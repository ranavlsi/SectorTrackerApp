import yfinance as yf
import pandas as pd
from datetime import datetime

t = yf.Ticker('CPNG')
df = t.history(period="100d")
close = df['Close']
open_s = df['Open']
vol = df['Volume']
low = df['Low']
high = df['High']

avg_vol_50 = vol.iloc[-70:-20].mean()

for i in range(-20, -1):
    prev_c = close.iloc[i-1]
    day_o = open_s.iloc[i]
    day_c = close.iloc[i]
    day_v = vol.iloc[i]
    
    if day_o > prev_c * 1.04 and day_v > avg_vol_50 * 2.5 and day_c >= day_o * 0.99:
        gap_pct = ((day_o/prev_c)-1)*100
        days_since = abs(i) - 1
        print(f"Triggered at index {i} (Days ago: {days_since})")
        print(f"Date: {df.index[i]}")
        print(f"Prev Close: {prev_c}, Open: {day_o}, Close: {day_c}")
        print(f"Gap: {gap_pct:.2f}%")
        print(f"Volume: {day_v}, Avg Vol: {avg_vol_50}, Ratio: {day_v/avg_vol_50:.2f}")

