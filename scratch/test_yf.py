import yfinance as yf
import time

t0 = time.time()
tickers = ["AAPL", "ORCL", "AAL", "AA", "IBM", "MSFT"]
mcaps = {}
for t in tickers:
    try:
        mcaps[t] = yf.Ticker(t).info.get("marketCap", 0)
    except:
        pass
print(mcaps)
print(f"Time: {time.time()-t0:.2f}s")
