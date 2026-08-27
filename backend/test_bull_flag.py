import yfinance as yf
import pandas as pd
from bull_flag_scanner import detect_bull_flag

print("Downloading AMD data...")
df = yf.download("AMD", period="6mo", interval="1d")
df.columns = df.columns.get_level_values(0) if isinstance(df.columns, pd.MultiIndex) else df.columns
if 'Adj Close' in df.columns:
    df.drop('Adj Close', axis=1, inplace=True)
df.reset_index(inplace=True)
df.rename(columns={'close':'Close', 'high':'High', 'low':'Low', 'open':'Open', 'volume':'Volume'}, inplace=True)

print("Running detect_bull_flag...")
res = detect_bull_flag("AMD", df)
print("Result:", res)
