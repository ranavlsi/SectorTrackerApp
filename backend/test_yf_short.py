import yfinance as yf
t = yf.Ticker("AAPL")
print("shortPercentOfFloat:", t.info.get('shortPercentOfFloat'))
print("shortRatio:", t.info.get('shortRatio'))
