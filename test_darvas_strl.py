import yfinance as yf
import pandas as pd

df = yf.download("STRL", period="1y")
if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.get_level_values(0)

print("Recent Price Action for STRL:")
print(df.tail(15)[['High', 'Low', 'Close', 'Volume']])

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

current_close = float(df['Close'].iloc[-1])
prev_close = float(df['Close'].iloc[-2])
current_vol = float(df['Volume'].iloc[-1])
avg_vol_50 = float(df['Volume'].iloc[-50:].mean())

print(f"Current Close: {current_close}, Prev Close: {prev_close}")
print(f"Current Vol: {current_vol}, Avg Vol 50: {avg_vol_50}, Vol Ratio: {current_vol/avg_vol_50}")

if current_close > box_top and prev_close <= box_top:
    if current_vol > (avg_vol_50 * 1.5):
        print("Signal: STRONG_BREAKOUT")
    else:
        print("Signal: Cleared top, but volume not > 1.5x")
elif box_bottom <= current_close <= box_top:
    dist = (box_top - current_close) / current_close
    print(f"Distance to top: {dist*100:.2f}%")
    if dist <= 0.02:
        print("Signal: ABOUT_TO_BREAKOUT")
else:
    print("Signal: NONE")

