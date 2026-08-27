import pandas as pd
import numpy as np

# Load a few stocks from the lakehouse
df = pd.read_parquet('backend/data/daily_ohlcv.parquet')
tickers = df.index.get_level_values(0).unique()[:500]

def calc_atr(d, period=20):
    high_low = d['High'] - d['Low']
    high_close = np.abs(d['High'] - d['Close'].shift(1))
    low_close = np.abs(d['Low'] - d['Close'].shift(1))
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = ranges.max(axis=1)
    return true_range.rolling(period).mean()

fail_counts = {"length":0, "trend":0, "depth":0, "pos":0, "pivot":0, "adr":0, "vdu":0, "up_down":0, "contraction":0, "ttm":0, "passed":0}

for t in tickers:
    data = df.loc[t].copy()
    if len(data) < 125: 
        fail_counts["length"] += 1
        continue
    data['SMA_50'] = data['Close'].rolling(50).mean()
    data['SMA_200'] = data['Close'].rolling(200).mean()
    if not ((data['Close'].iloc[-1] > data['SMA_50'].iloc[-1]) and (data['SMA_50'].iloc[-1] > data['SMA_200'].iloc[-1])):
        fail_counts["trend"] += 1
        continue
    data['Base_High'] = data['High'].rolling(120).max()
    data['Base_Low'] = data['Low'].rolling(120).min()
    base_depth = (data['Base_High'].iloc[-1] - data['Base_Low'].iloc[-1]) / data['Base_High'].iloc[-1]
    if base_depth > 0.35:
        fail_counts["depth"] += 1
        continue
    pos_in_base = (data['Close'].iloc[-1] - data['Base_Low'].iloc[-1]) / (data['Base_High'].iloc[-1] - data['Base_Low'].iloc[-1])
    if pos_in_base < 0.85:
        fail_counts["pos"] += 1
        continue
    data['Local_Pivot'] = data['High'].shift(1).rolling(15).max()
    dist_to_pivot = (data['Local_Pivot'].iloc[-1] - data['Close'].iloc[-1]) / data['Local_Pivot'].iloc[-1]
    if dist_to_pivot < 0.005 or dist_to_pivot > 0.08:
        fail_counts["pivot"] += 1
        continue
    data['Daily_Range'] = (data['High'] / data['Low']) - 1
    adr_20 = data['Daily_Range'].rolling(20).mean().iloc[-1] * 100
    if adr_20 > 4.5:
        fail_counts["adr"] += 1
        continue
    data['Vol_SMA_50'] = data['Volume'].rolling(50).mean()
    data['Is_VDU'] = data['Volume'] < (0.5 * data['Vol_SMA_50'])
    if not data['Is_VDU'].iloc[-5:].any():
        fail_counts["vdu"] += 1
        continue
    data['Is_Up_Day'] = data['Close'] > data['Close'].shift(1)
    data['Is_Down_Day'] = data['Close'] < data['Close'].shift(1)
    data['Up_Vol'] = np.where(data['Is_Up_Day'], data['Volume'], 0)
    data['Down_Vol'] = np.where(data['Is_Down_Day'], data['Volume'], 0)
    up_vol_50 = pd.Series(data['Up_Vol']).rolling(50).sum().iloc[-1]
    down_vol_50 = pd.Series(data['Down_Vol']).rolling(50).sum().iloc[-1]
    ratio = up_vol_50 / down_vol_50 if down_vol_50 > 0 else 1.0
    if ratio < 1.15:
        fail_counts["up_down"] += 1
        continue
    data['ATR_5'] = calc_atr(data, 5)
    data['ATR_20'] = calc_atr(data, 20)
    if data['ATR_5'].iloc[-1] >= (data['ATR_20'].iloc[-1] * 0.85):
        fail_counts["contraction"] += 1
        continue
    fail_counts["ttm"] += 1

print(fail_counts)
