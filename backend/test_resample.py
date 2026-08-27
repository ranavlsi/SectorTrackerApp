from alpaca_trade_api.rest import REST, TimeFrame
import pandas as pd
from datetime import datetime, timedelta

# Mocking the intraday_engine.py logic
api = REST("PKD08X2R18LFE21L1R3S", "hK7Q1JqY8Bf2p0TzQ9V6xG4wK1sL0mC3nN5xV9lB", "https://paper-api.alpaca.markets")

end_dt = pd.Timestamp.now(tz='America/New_York')
start_dt = end_dt - pd.Timedelta(days=3)

bars = api.get_bars("LLY", TimeFrame.Minute, start_dt.strftime('%Y-%m-%d'), end_dt.strftime('%Y-%m-%d'), adjustment='raw').df
if not bars.empty:
    bars.index = bars.index.tz_convert('America/New_York')
    
    agg_dict = {'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'}
    df_5m = bars.resample('5min', closed='right', label='right').agg(agg_dict).dropna()
    
    today_str = datetime.now().strftime('%Y-%m-%d')
    today_5m = df_5m[df_5m.index.strftime('%Y-%m-%d') == today_str]
    today_5m = today_5m.between_time('09:30', '16:00')
    
    print("5m bars:")
    print(today_5m.head(5))
