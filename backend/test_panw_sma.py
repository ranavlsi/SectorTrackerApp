import yfinance as yf
import pandas as pd

t = yf.Ticker('PANW')
df = t.history(period="100d", interval="1d")

if len(df) >= 34:
    df['SMA_20'] = df['Close'].rolling(20).mean()
    df['SMA_34'] = df['Close'].rolling(34).mean()
    
    last_3 = df.tail(3)
    for idx, row in last_3.iterrows():
        print(f"Date: {idx.strftime('%Y-%m-%d')}, Close: {row['Close']:.2f}, SMA 20: {row['SMA_20']:.2f}, SMA 34: {row['SMA_34']:.2f}")

