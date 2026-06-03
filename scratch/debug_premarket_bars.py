import sys
sys.path.append('backend')
from premarket_gappers import *

client = StockHistoricalDataClient(api_key, secret_key)
now = datetime.now(pytz.timezone('America/New_York'))
start_time = now.replace(hour=4, minute=0, second=0, microsecond=0)

alpaca_top_tickers = ['MDB', 'ARM']
bars_req = StockBarsRequest(
    symbol_or_symbols=alpaca_top_tickers,
    timeframe=TimeFrame(1, TimeFrameUnit.Minute),
    start=start_time,
    end=now,
    feed=DataFeed.IEX
)

try:
    bars_df = client.get_stock_bars(bars_req).df
    print(bars_df.head(2))
    print(bars_df.tail(2))
except Exception as e:
    print("Error:", e)
