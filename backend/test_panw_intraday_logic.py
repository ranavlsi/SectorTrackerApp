import os
from dotenv import load_dotenv
import pandas as pd
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from alpaca.data.enums import DataFeed
from datetime import datetime, timedelta

load_dotenv()
api_key = os.getenv('APCA_API_KEY_ID')
api_secret = os.getenv('APCA_API_SECRET_KEY')

client = StockHistoricalDataClient(api_key, api_secret)
end_dt = datetime.now()
daily_start_date = end_dt - timedelta(days=100)

req_daily = StockBarsRequest(
    symbol_or_symbols=["PANW"],
    timeframe=TimeFrame(1, TimeFrameUnit.Day),
    start=daily_start_date,
    end=end_dt,
    feed=DataFeed.IEX
)
bars_daily = client.get_stock_bars(req_daily)

df_d_chunk = bars_daily.df.reset_index()
df_d_chunk['symbol'] = df_d_chunk['symbol'].str.replace('.', '-')

df_bulk_daily = df_d_chunk.rename(columns={'symbol': 'Ticker', 'timestamp': 'Date', 'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'volume': 'Volume'})
df_bulk_daily = df_bulk_daily.set_index(['Ticker', 'Date'])

df_daily = df_bulk_daily.loc['PANW'].copy()

df_daily['SMA_20'] = df_daily['Close'].rolling(20).mean()
df_daily['SMA_34'] = df_daily['Close'].rolling(34).mean()

c = df_daily.iloc[-1]
p = df_daily.iloc[-2]

print(f"IEX Data points: {len(df_daily)}")
print(f"Current: SMA20={c['SMA_20']:.2f}, SMA34={c['SMA_34']:.2f}")
print(f"Previous: SMA20={p['SMA_20']:.2f}, SMA34={p['SMA_34']:.2f}")

if c['SMA_20'] > c['SMA_34'] and p['SMA_20'] <= p['SMA_34']:
    print("CROSSOVER TRUE IN INTRADAY_ENGINE!")
else:
    print("NO CROSSOVER!")
