import pandas as pd
from backend.qullamaggie_engine import evaluate_qullamaggie_setup

df = pd.read_parquet('backend/data/daily_ohlcv.parquet')
vsts_df = df[df['Ticker'] == "VSTS"].copy()

# Add Volume column if missing or rename correctly
vsts_df.rename(columns={'close':'Close', 'high':'High', 'low':'Low', 'open':'Open', 'volume':'Volume'}, inplace=True)
vsts_df = vsts_df.reset_index(drop=True)

res = evaluate_qullamaggie_setup("VSTS", pre_df=vsts_df)
print("Engine Result (Lakehouse Data):", res)

import numpy as np
from scipy.stats import linregress

vsts_df['Daily_Range_Pct'] = (vsts_df['High'] - vsts_df['Low']) / vsts_df['Close'].shift(1)
adr_20 = vsts_df['Daily_Range_Pct'].rolling(window=20).mean().iloc[-2] * 100
print("ADR 20:", adr_20)

last_40 = vsts_df.iloc[-41:-1].copy()
x = np.arange(len(last_40))
last_40['Log_Close'] = np.log(last_40['Close'])
slope, _, r_val, _, _ = linregress(x, last_40['Log_Close'])
print("R-Squared:", r_val**2)
print("Slope:", slope)

vsts_df['SMA_50_Vol'] = vsts_df['Volume'].rolling(window=50).mean()
max_vol_ratio = (last_40['Volume'] / last_40['SMA_50_Vol']).max()
print("Max Volume Thrust:", max_vol_ratio)

vsts_df['TR'] = np.maximum((vsts_df['High'] - vsts_df['Low']), 
                      np.maximum(abs(vsts_df['High'] - vsts_df['Close'].shift(1)), 
                                 abs(vsts_df['Low'] - vsts_df['Close'].shift(1))))
atr_3 = vsts_df['TR'].rolling(window=3).mean().iloc[-2]
atr_20 = vsts_df['TR'].rolling(window=20).mean().iloc[-2]
print("ATR Crush (3/20):", atr_3/atr_20)

