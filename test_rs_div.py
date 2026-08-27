import yfinance as yf
import pandas as pd
import numpy as np

tickers = ["NVDA", "AAPL", "MSFT", "TSLA", "META"]
data = yf.download(tickers + ["SPY"], period="6mo", interval="1d", group_by="ticker", progress=False)

spy_close = data["SPY"]["Close"].dropna()

for ticker in tickers:
    close = data[ticker]["Close"].dropna()
    high = data[ticker]["High"].dropna()
    
    if len(close) < 100: continue
    
    stock_aligned, spy_aligned = close.align(spy_close, join='inner')
    rs_line = stock_aligned / spy_aligned
    
    curr_c = close.iloc[-1]
    
    if len(stock_aligned) >= 63:
        rs_63d_max = rs_line.iloc[-63:].max()
        
        high_slice = high.iloc[-63:]
        price_63d_max = high_slice.max()
        days_since_high = 62 - high_slice.values.argmax()
        
        is_rs_high = rs_line.iloc[-1] >= (rs_63d_max * 0.97) 
        is_price_consolidating = days_since_high >= 5 
        is_price_diverging = curr_c < (price_63d_max * 0.99) 
        is_close_enough = curr_c >= (price_63d_max * 0.85) 
        is_uptrend = curr_c > close.rolling(63).mean().iloc[-1]
        
        print(f"[{ticker}] rs_high:{is_rs_high}, cons:{is_price_consolidating}, div:{is_price_diverging}, close_en:{is_close_enough}, uptrend:{is_uptrend}")
        print(f"    days_since_high: {days_since_high}, rs_line[-1]: {rs_line.iloc[-1]:.4f}, max: {rs_63d_max:.4f}")
