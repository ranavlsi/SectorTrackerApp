import glob
import re
import yfinance as yf
import pandas as pd

scan_universe = set()
txt_files = glob.glob("/Users/amitkumar/Desktop/TradingView_Watchlists/*.txt")
for file_path in txt_files:
    with open(file_path, 'r') as f:
        tokens = re.split(r'[,\n\s]+', f.read())
        for token in tokens:
            ticker_part = token.strip().split(':')[-1].upper()
            if 1 <= len(ticker_part) <= 5 and ticker_part.isalpha():
                scan_universe.add(ticker_part)

scan_universe = list(scan_universe)
df = yf.download(scan_universe, period="5d", prepost=True, progress=False)
closes = df['Close']

movers = []
for ticker in scan_universe:
    try:
        series = closes[ticker].dropna()
        if len(series) >= 2:
            prev = series.iloc[-2]
            curr = series.iloc[-1]
            pct = ((curr - prev) / prev) * 100
            if pct > 0:
                movers.append((ticker, pct, curr))
    except Exception:
        pass

movers.sort(key=lambda x: x[1], reverse=True)
for m in movers[:3]:
    print(f"TICKER: {m[0]}, PCT: {m[1]:.2f}%, PRICE: ${m[2]:.2f}")
