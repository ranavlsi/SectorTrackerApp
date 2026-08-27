from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from datetime import datetime, timedelta
import pandas as pd
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('ALPACA_API_KEY', 'PKD08X2R18LFE21L1R3S')
api_secret = os.getenv('ALPACA_API_SECRET', 'hK7Q1JqY8Bf2p0TzQ9V6xG4wK1sL0mC3nN5xV9lB')
client = StockHistoricalDataClient(api_key, api_secret)

end_dt = datetime.now()
start_dt = end_dt - timedelta(days=100)

req = StockBarsRequest(
    symbol_or_symbols=["PANW"],
    timeframe=TimeFrame.Day,
    start=start_dt,
    end=end_dt
)

df = client.get_stock_bars(req).df
print(df.tail(5))

df['SMA_20'] = df['close'].rolling(20).mean()
df['SMA_34'] = df['close'].rolling(34).mean()

c = df.iloc[-1]
p = df.iloc[-2]

print(f"Current: SMA20={c['SMA_20']:.2f}, SMA34={c['SMA_34']:.2f}")
print(f"Previous: SMA20={p['SMA_20']:.2f}, SMA34={p['SMA_34']:.2f}")

if c['SMA_20'] > c['SMA_34'] and p['SMA_20'] <= p['SMA_34']:
    print("CROSSOVER DETECTED!")
else:
    print("NO CROSSOVER!")
