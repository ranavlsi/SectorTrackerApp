import yfinance as yf
t = yf.Ticker('AAPL')
inc = t.quarterly_financials
date = inc.columns[0]
print(type(date))
print(inc.loc['Total Revenue', date])
