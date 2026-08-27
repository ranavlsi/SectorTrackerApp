import yfinance as yf
import pandas as pd

df = yf.download("NVDA", period="2y")
# Clean columns if MultiIndex
if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.get_level_values(0)

# Replicate Darvas logic
current_close = float(df['Close'].iloc[-1])
current_vol = float(df['Volume'].iloc[-1])
avg_vol_50 = float(df['Volume'].iloc[-50:].mean())

high_52w = float(df['High'].iloc[-252:].max())

print(f"Current Close: {current_close}")
print(f"52w High: {high_52w} (Threshold: {high_52w*0.85})")
print(f"Macro check passed? {current_close >= high_52w * 0.85}")

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
        box_top = test_high
        top_idx = i
        break

print(f"Box Top: {box_top} (found {top_idx} days ago)")

box_bottom = float('inf')
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

prev_close = float(df['Close'].iloc[-2])
print(f"Prev Close: {prev_close}")
print(f"Current Vol: {current_vol}, Avg Vol 50: {avg_vol_50}, Ratio: {current_vol/avg_vol_50}")

if current_close > box_top and prev_close <= box_top:
    if current_vol > (avg_vol_50 * 1.5):
        print("Signal: STRONG_BREAKOUT")
    else:
        print("Cleared top, but volume not > 1.5x")
elif box_bottom <= current_close <= box_top:
    dist = (box_top - current_close) / current_close
    print(f"Distance to top: {dist*100}%")
    if dist <= 0.02:
        print("Signal: ABOUT_TO_BREAKOUT")

