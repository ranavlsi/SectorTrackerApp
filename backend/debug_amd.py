import yfinance as yf
t = yf.Ticker('AMD')
inc = t.get_financials(freq='quarterly')
print(inc)
