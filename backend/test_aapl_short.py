import yfinance as yf
t = yf.Ticker('AAPL')
info = t.info
print(f"Short Percent of Float: {info.get('shortPercentOfFloat')}")
print(f"Short Ratio: {info.get('shortRatio')}")
print(f"Shares Short: {info.get('sharesShort')}")
print(f"Float Shares: {info.get('floatShares')}")
