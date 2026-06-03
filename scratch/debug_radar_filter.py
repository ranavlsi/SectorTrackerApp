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
    symbol_or_symbols=['NVDA', 'SMCI', 'MRVL'],
    timeframe=TimeFrame(1, TimeFrameUnit.Minute),
    start=start_date,
    end=end_date,
    feed=DataFeed.IEX
)
bars = client.get_stock_bars(request_params)
df_bulk = bars.df.reset_index()
df_bulk['symbol'] = df_bulk['symbol'].str.replace('.', '-')
df_bulk = df_bulk.rename(columns={'symbol': 'Ticker', 'timestamp': 'Date', 'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'volume': 'Volume'})
df_bulk = df_bulk.set_index(['Ticker', 'Date'])

for ticker in ['NVDA', 'SMCI', 'MRVL']:
    df_1m = df_bulk.loc[ticker].copy()
    df_1m.index = pd.to_datetime(df_1m.index)
    agg_dict = {'Open': 'first', 'High': 'max', 'Low': 'min', 'Close': 'last', 'Volume': 'sum'}
    df_5m = df_1m.resample('5min', closed='right', label='right').agg(agg_dict).dropna()
    
    today_str = datetime.now().strftime('%Y-%m-%d')
    today_5m_ui = df_5m[df_5m.index.strftime('%Y-%m-%d') == today_str]
    today_1m_ui = df_1m[df_1m.index.strftime('%Y-%m-%d') == today_str]
    
    if len(today_5m_ui) >= 3:
        orb_pivot = float(today_5m_ui['High'].iloc[0:3].max())
    elif len(today_1m_ui) > 0:
        orb_pivot = float(today_1m_ui['High'].max())
    else:
        orb_pivot = float(df_1m['High'].max())
        
    current_price = float(df_1m['Close'].iloc[-1])
    
    print(f"{ticker}: today_1m_ui length: {len(today_1m_ui)}, orb_pivot: {orb_pivot}, current_price: {current_price}, Pass: {current_price >= orb_pivot * 0.995}")
try:
    run_algorithms(ticker, df_1m, df_5m, {})
except Exception as e:
    import traceback
    print(f"ERROR in run_algorithms for {ticker}: {e}")
    traceback.print_exc()
