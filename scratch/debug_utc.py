import sys
sys.path.append('backend')
from intraday_engine import *

import os
import pytz
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
end_date = datetime.now(pytz.utc)
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
print(df_1m.tail(3))
