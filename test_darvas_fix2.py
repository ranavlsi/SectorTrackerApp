import yfinance as yf
import pandas as pd

df = yf.download("NVDA", period="1y")
if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.get_level_values(0)

box_top = 0
top_idx = -1

for i in range(4, 60):
    test_high = float(df['High'].iloc[-i])
    exceeded = False
    for j in range(1, 4):
        if float(df['High'].iloc[-(i-j)]) > test_high:
            exceeded = True
            break
            
    if not exceeded:
        # Validate it wasn't broken by any day between the 3-day window and yesterday
        valid = True
        # i is the day of the top. The 3-day window is i-1, i-2, i-3.
        # We need to check from i-4 down to 2 (yesterday).
        for k in range(2, i - 3):
            if float(df['High'].iloc[-k]) > test_high:
                valid = False
                break
        
        if valid:
            box_top = test_high
            top_idx = i
            break

print(f"Box Top: {box_top}, Top Idx: {top_idx}")

