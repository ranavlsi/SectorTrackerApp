import yfinance as yf
import pandas as pd

tickers = ["NVDA", "TSLA", "AAPL", "AMD", "SMCI"]
df = yf.download(tickers, period="2d", prepost=True, progress=False)
print("DF COLUMNS:", df.columns)
if 'Close' in df.columns:
    print(df['Close'].tail())
