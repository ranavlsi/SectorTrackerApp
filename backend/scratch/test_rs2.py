import yfinance as yf
df = yf.download(['ASTS', 'SPY'], period='4y', interval='1d', group_by='ticker')
spy_close = df['SPY']['Close'].dropna()
close = df['ASTS']['Close'].dropna()
aligned_spy = spy_close.reindex(close.index).ffill()
rs_1mo = ((close.iloc[-1] / aligned_spy.iloc[-1]) / (close.iloc[-20] / aligned_spy.iloc[-20]) - 1) * 100
print("ASTS RS:", rs_1mo)
