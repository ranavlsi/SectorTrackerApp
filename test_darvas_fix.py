import yfinance as yf
import pandas as pd

df = yf.download("NVDA", period="1y")
if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.get_level_values(0)

print(df.tail(10)[['High', 'Low', 'Close']])

