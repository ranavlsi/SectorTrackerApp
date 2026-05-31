import yfinance as yf
import pandas as pd

tickers = ["NVDA", "TSLA", "AAPL", "AMD", "SMCI"]
df = yf.download(tickers, period="5d", prepost=True, progress=False)
closes = df['Close']
print(closes)

movers = []
for t in tickers:
    try:
        series = closes[t].dropna()
        if len(series) >= 2:
            prev_close = series.iloc[-2]
            current_price = series.iloc[-1]
            pct_change = (current_price - prev_close) / prev_close
            movers.append((t, pct_change * 100, current_price))
    except Exception as e:
        print(f"Error {t}: {e}")
        
movers.sort(key=lambda x: x[1], reverse=True)
print(movers)
