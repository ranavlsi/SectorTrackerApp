import yfinance as yf
from backend.qullamaggie_engine import evaluate_qullamaggie_setup

res = evaluate_qullamaggie_setup("VSTS")
print("Engine Result:", res)

# Let's manually print the conditions to show the exact numbers
import pandas as pd
import numpy as np
from scipy.stats import linregress

from yahooquery import Ticker as YQTicker
df = YQTicker("VSTS").history(period="6mo", interval="1d")
df = df.loc["vsts" if "vsts" in df.index.levels[0] else "VSTS"].reset_index()
df.rename(columns={'close':'Close', 'high':'High', 'low':'Low', 'open':'Open', 'volume':'Volume'}, inplace=True)
df['Close'] = df['Close'].ffill()

df['Dollar_Volume'] = df['Close'] * df['Volume']
print("Dollar Volume ($M):", df['Dollar_Volume'].rolling(window=20).mean().iloc[-1] / 1000000)

df['Daily_Range_Pct'] = (df['High'] - df['Low']) / df['Close'].shift(1)
adr_20 = df['Daily_Range_Pct'].rolling(window=20).mean().iloc[-2] * 100
print("ADR 20 (%):", adr_20)

df['TR'] = np.maximum((df['High'] - df['Low']), 
                      np.maximum(abs(df['High'] - df['Close'].shift(1)), 
                                 abs(df['Low'] - df['Close'].shift(1))))
df['ATR_3'] = df['TR'].rolling(window=3).mean()
df['ATR_20'] = df['TR'].rolling(window=20).mean()

df['SMA_10'] = df['Close'].rolling(window=10).mean()
df['SMA_20'] = df['Close'].rolling(window=20).mean()
df['SMA_50_Vol'] = df['Volume'].rolling(window=50).mean()

last_40_days = df.iloc[-41:-1].copy()
last_40_days['Log_Close'] = np.log(last_40_days['Close'])
x = np.arange(len(last_40_days))
slope, intercept, r_value, p_value, std_err = linregress(x, last_40_days['Log_Close'])
print("R-squared:", r_value**2)
print("Slope:", slope)

max_vol_ratio = (last_40_days['Volume'] / last_40_days['SMA_50_Vol']).max()
print("Max Vol Thrust Ratio:", max_vol_ratio)

min_low_3 = df['Low'].iloc[-4:-1].min()
min_close_3 = df['Close'].iloc[-4:-1].min()
sma_10_prev = df['SMA_10'].iloc[-2]
print("Surfing 10-SMA (Low <= 1.05x, Close > 0.98x):", min_low_3 <= sma_10_prev * 1.05, min_close_3 > sma_10_prev * 0.98)

atr_ratio = df['ATR_3'].iloc[-2] / df['ATR_20'].iloc[-2]
print("ATR Crush Ratio (< 0.70):", atr_ratio)

swing_high_15 = df['High'].iloc[-16:-1].max()
curr_price = df['Close'].iloc[-1]
print(f"Current Price: {curr_price}, 15-day Swing High: {swing_high_15}, Triggered: {curr_price > swing_high_15}")
