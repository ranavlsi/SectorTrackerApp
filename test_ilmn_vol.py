import yfinance as yf
import pandas as pd

df = yf.download("ILMN", period="5y")
if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.get_level_values(0)

vol = df['Volume']
curr_vol = vol.iloc[-1]

vol_21d = vol.iloc[-21:].max()
vol_63d = vol.iloc[-63:].max()
vol_126d = vol.iloc[-126:].max()
vol_252d = vol.iloc[-252:].max()
vol_all = vol.max()

print(f"Curr Vol: {curr_vol}")
print(f"21d max: {vol_21d} - Is HVE? {curr_vol >= vol_21d * 0.95}")
print(f"63d max: {vol_63d} - Is HVE? {curr_vol >= vol_63d * 0.95}")
print(f"126d max: {vol_126d} - Is HVE? {curr_vol >= vol_126d * 0.95}")
print(f"252d max: {vol_252d} - Is HVE? {curr_vol >= vol_252d * 0.95}")
print(f"Lifetime max: {vol_all} - Is HVE? {curr_vol >= vol_all * 0.95}")

