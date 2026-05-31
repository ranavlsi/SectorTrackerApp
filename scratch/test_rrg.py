import yfinance as yf
import pandas as pd
import numpy as np

df = yf.download(['SMH', 'SPY'], period='6mo', interval='1d')['Close']
rs = df['SMH'] / df['SPY']

print("--- Current Formula (10/40) ---")
d_ratio = (rs.rolling(10).mean() / rs.rolling(40).mean()) * 100
d_mom = (d_ratio / d_ratio.rolling(10).mean()) * 100
print(f"Ratio: {d_ratio.iloc[-1]:.2f}, Mom: {d_mom.iloc[-1]:.2f}")
# If Ratio > 100 and Mom < 100 -> Weakening

print("--- Fast MACD Formula (5/20) ---")
d_ratio_fast = (rs.rolling(5).mean() / rs.rolling(20).mean()) * 100
d_mom_fast = (d_ratio_fast / d_ratio_fast.rolling(5).mean()) * 100
print(f"Ratio: {d_ratio_fast.iloc[-1]:.2f}, Mom: {d_mom_fast.iloc[-1]:.2f}")

print("--- True JdK Formula (14) ---")
# RS-Ratio = 100 + ((RS - SMA(RS, 14)) / StdDev(RS, 14)) ? No, JdK is proprietary, but commonly approximated as:
# RS-Ratio = 100 + ROC(SMA(RS, 14), 14) ? 
# Let's try Normalized RS
rs_norm = (rs - rs.rolling(14).mean()) / rs.rolling(14).std()
ratio_jdk = 100 + (rs_norm * 10)
mom_jdk = 100 + ((ratio_jdk - ratio_jdk.rolling(14).mean()) / ratio_jdk.rolling(14).std() * 10)
print(f"Ratio: {ratio_jdk.iloc[-1]:.2f}, Mom: {mom_jdk.iloc[-1]:.2f}")

print("--- Normalized Rate of Change Formula (14) ---")
roc = rs.pct_change(14) * 100
ratio_roc = 100 + roc
mom_roc = 100 + roc.diff(5) # momentum of ROC
print(f"Ratio: {ratio_roc.iloc[-1]:.2f}, Mom: {mom_roc.iloc[-1]:.2f}")
