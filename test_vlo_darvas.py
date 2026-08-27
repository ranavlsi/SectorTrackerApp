import yfinance as yf
import pandas as pd

df = yf.download("VLO", period="1y")
if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.get_level_values(0)

print(df.tail(15)[['High', 'Low', 'Close']])

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
        for k in range(2, i - 3):
            if float(df['High'].iloc[-k]) > test_high:
                valid = False
                break
        
        if valid:
            box_top = test_high
            top_idx = i
            break

print(f"\nBox Top: {box_top}, Top Idx: {top_idx}")

box_bottom = float('inf')
if box_top > 0:
    for i in range(3, top_idx):
        test_low = float(df['Low'].iloc[-i])
        broken = False
        for j in range(1, 4):
            if i-j > 0 and float(df['Low'].iloc[-(i-j)]) < test_low:
                broken = True
                break
        if not broken:
            box_bottom = test_low
            break
print(f"Box Bottom: {box_bottom}")

