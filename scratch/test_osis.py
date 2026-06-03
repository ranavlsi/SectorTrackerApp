import sys
import pandas as pd
import duckdb
sys.path.append('backend')
from qullamaggie_engine import evaluate_qullamaggie_setup

df = duckdb.query("SELECT * FROM read_parquet('backend/data/daily_ohlcv.parquet') WHERE Ticker='OSIS' ORDER BY Date").to_df()
df['Date'] = pd.to_datetime(df['Date'])
df.set_index('Date', inplace=True)
df.rename(columns={'Close':'Close', 'High':'High', 'Low':'Low', 'Open':'Open', 'Volume':'Volume'}, inplace=True)
df = df.reset_index()

# print some stats
curr_price = df['Close'].iloc[-1]
recent_low = df['Low'].iloc[-4:-1].min()
sma_10_curr = df['Close'].rolling(window=10).mean().iloc[-1]
sma_20_curr = df['Close'].rolling(window=20).mean().iloc[-1]
print(f"curr_price: {curr_price}, recent_low: {recent_low}, sma10: {sma_10_curr}, sma20: {sma_20_curr}")

res = evaluate_qullamaggie_setup('OSIS', pre_df=df)
print("Result:", res)
