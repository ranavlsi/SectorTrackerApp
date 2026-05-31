import yfinance as yf
import time
from concurrent.futures import ThreadPoolExecutor

tickers = ["AAPL", "ORCL", "AAL", "AA", "IBM", "MSFT"]

def get_mcap(t):
    try:
        return t, yf.Ticker(t).fast_info.get("market_cap", 0)
    except:
        return t, 0

t0 = time.time()
mcaps = {}
with ThreadPoolExecutor(max_workers=20) as executor:
    for t, m in executor.map(get_mcap, tickers):
        mcaps[t] = m

print(mcaps)
print(f"Time: {time.time()-t0:.2f}s")
