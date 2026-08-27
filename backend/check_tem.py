import sys
import os
sys.path.append(os.getcwd())
import yfinance as yf
from sector_data_api import calculate_stage

t = yf.Ticker("TEM")
hist = t.history(period="2y")
close = hist['Close']
sma200 = close.rolling(200).mean()

print(f"Total days: {len(close)}")
if len(close) >= 200:
    print(f"Current Price: {close.iloc[-1]:.2f}")
    print(f"Current 200 SMA: {sma200.iloc[-1]:.2f}")
    print(f"Past 200 SMA (20 days ago): {sma200.iloc[-20]:.2f}")

    slope200 = (sma200.iloc[-1] - sma200.iloc[-20]) / sma200.iloc[-20] * 100
    price_pos = (close.iloc[-1] - sma200.iloc[-1]) / sma200.iloc[-1] * 100
    sma50 = close.rolling(50).mean()
    current_sma50 = sma50.iloc[-1]
    sma20 = close.rolling(20).mean()
    slope50 = (current_sma50 - sma50.iloc[-10]) / sma50.iloc[-10] * 100
    slope20 = (sma20.iloc[-1] - sma20.iloc[-5]) / sma20.iloc[-5] * 100

    print(f"200 SMA Slope: {slope200:.2f}%")
    print(f"50 SMA Slope: {slope50:.2f}%")
    print(f"20 SMA Slope: {slope20:.2f}%")
    print(f"Price Position vs 200 SMA: {price_pos:.2f}%")
    print(f"Price vs 50 SMA: {close.iloc[-1]:.2f} vs {current_sma50:.2f}")
else:
    print("Not enough history for 200 SMA!")

stage = calculate_stage(close, sma200)
print(f"Calculated Stage: {stage}")
