import os
from dotenv import load_dotenv
import pandas as pd
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from datetime import datetime, timedelta

load_dotenv()
api_key = os.getenv('APCA_API_KEY_ID')
api_secret = os.getenv('APCA_API_SECRET_KEY')

client = StockHistoricalDataClient(api_key, api_secret)
end_dt = datetime.now()
start_dt = end_dt - timedelta(days=100)

req = StockBarsRequest(
    symbol_or_symbols=["PANW"],
    timeframe=TimeFrame(1, TimeFrameUnit.Day),
    start=start_dt,
    end=end_dt
)
bars = client.get_stock_bars(req)
df = bars.df.reset_index()
df = df.set_index('timestamp')
# DO NOT SORT here. Let's see how Alpaca naturally returns it.

df['SMA_20'] = df['close'].rolling(20).mean()
df['SMA_34'] = df['close'].rolling(34).mean()

for i in range(-5, 0):
    c = df.iloc[i]
    print(f"Date: {df.index[i]}, Close: {c['close']}, SMA20: {c['SMA_20']:.2f}, SMA34: {c['SMA_34']:.2f}")

c = df.iloc[-1]
p = df.iloc[-2]
if c['SMA_20'] > c['SMA_34'] and p['SMA_20'] <= p['SMA_34']:
    print("CROSSOVER TRUE!")
else:
    print("NO CROSSOVER!")
