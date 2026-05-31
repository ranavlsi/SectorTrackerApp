import yfinance as yf
tickers = ['PLTR', 'ASTS', 'HOOD', 'RDDT', 'ALAB', 'ARM', 'CAVA', 'SMCI', 'CELH']
for tk in tickers:
    t = yf.Ticker(tk)
    short_pct = t.info.get('shortPercentOfFloat', 0)
    print(f"{tk}: {short_pct * 100 if short_pct else 0}%")
