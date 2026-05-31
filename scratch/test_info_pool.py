import yfinance as yf
import time
from concurrent.futures import ThreadPoolExecutor

# Generate a list of 50 tickers
tickers = ["AAPL", "ORCL", "AAL", "AA", "IBM", "MSFT", "TSLA", "NVDA", "AMD", "INTC"] * 5

def get_mcap(t):
    try:
        return t, yf.Ticker(t).info.get("marketCap", 0)
    except:
        return t, 0

t0 = time.time()
mcaps = {}
with ThreadPoolExecutor(max_workers=10) as executor:
    for t, m in executor.map(get_mcap, tickers):
        mcaps[t] = m

print(f"Time: {time.time()-t0:.2f}s")
print(list(mcaps.items())[:5])
