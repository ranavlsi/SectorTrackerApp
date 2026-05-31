from yahooquery import Ticker
t = Ticker('AAPL')
df = t.history(period="2y")
print(df.head())
print(df.columns)
print("Close column type:", type(df['close']))
# Fundamentals
info = t.summary_detail['AAPL']
print("Summary Detail Keys:", info.keys())
financials = t.financial_data['AAPL']
print("Financial Data Keys:", financials.keys())
