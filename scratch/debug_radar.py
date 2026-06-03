import sys
sys.path.append('backend')
from intraday_engine import *

import os
from dotenv import load_dotenv
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from alpaca.data.enums import DataFeed

load_dotenv(os.path.join(os.path.dirname('backend/premarket_gappers.py'), '.env'))
api_key = os.getenv("APCA_API_KEY_ID")
secret_key = os.getenv("APCA_API_SECRET_KEY")
client = StockHistoricalDataClient(api_key, secret_key)

from datetime import timedelta
end_date = datetime.now()
start_date = end_date - timedelta(days=5)

request_params = StockBarsRequest(
    symbol_or_symbols=['AAPL'],
    timeframe=TimeFrame(1, TimeFrameUnit.Minute),
    start=start_date,
    end=end_date,
    feed=DataFeed.IEX
)
bars = client.get_stock_bars(request_params)
df_1m = bars.df.reset_index()
df_1m['symbol'] = df_1m['symbol'].str.replace('.', '-')
df_1m = df_1m.rename(columns={'symbol': 'Ticker', 'timestamp': 'Date', 'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'volume': 'Volume'})
df_1m = df_1m.set_index(['Ticker', 'Date']).loc['AAPL'].copy()

df_1m.index = pd.to_datetime(df_1m.index)
print("Last 3 rows of df_1m:")
print(df_1m.tail(3))

today_str = datetime.now().strftime('%Y-%m-%d')
print("today_str:", today_str)

today_1m_ui = df_1m[df_1m.index.strftime('%Y-%m-%d') == today_str]
print("Rows in today_1m_ui:", len(today_1m_ui))
