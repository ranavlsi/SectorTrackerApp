import pandas as pd
from datetime import datetime, timedelta
import pytz
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
import os
from dotenv import load_dotenv

load_dotenv('/Users/amitkumar/Desktop/SectorTrackerApp/backend/.env')
client = StockHistoricalDataClient(os.getenv("APCA_API_KEY_ID"), os.getenv("APCA_API_SECRET_KEY"))

end_date = datetime.now(pytz.utc)
start_date = end_date - timedelta(days=5)

req = StockBarsRequest(symbol_or_symbols=['AMT'], timeframe=TimeFrame(1, TimeFrameUnit.Minute), start=start_date, end=end_date, feed='iex')
bars = client.get_stock_bars(req)
df = bars.df.reset_index()

df.index = pd.to_datetime(df['timestamp'])
if df.index.tz is None:
    df.index = df.index.tz_localize('UTC').tz_convert('America/New_York')
else:
    df.index = df.index.tz_convert('America/New_York')

agg_dict = {'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'}
df_5m = df.resample('5min', closed='right', label='right').agg(agg_dict).dropna()

today_str = datetime.now().strftime('%Y-%m-%d')
today_5m = df_5m[df_5m.index.strftime('%Y-%m-%d') == today_str]
market_hours_5m = today_5m.between_time('09:30', '16:00')

print("\nMarket Hours 5m bars:")
print(market_hours_5m.head(5))

if len(market_hours_5m) >= 3:
    print(f"\nORB Pivot (1st 3 bars max): {market_hours_5m['high'].iloc[0:3].max()}")
else:
    print("\nNot enough market hours bars.")
    
print(f"Current Price: {df['close'].iloc[-1]}")

