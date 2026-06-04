import sys
import os
sys.path.append(os.path.abspath('backend'))
import duckdb
import pandas as pd
from long_base_scanner import evaluate_medium_base

LAKEHOUSE_PATH = 'backend/data/daily_ohlcv.parquet'
lake_df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()
lake_df = lake_df.sort_values('Date')
grouped = lake_df.groupby('Ticker')

count = 0
for t, df in grouped:
    df = df.set_index('Date')
    df.rename(columns={'close':'Close', 'high':'High', 'low':'Low', 'open':'Open', 'volume':'Volume'}, inplace=True)
    if len(df) < 200: continue
    
    # Just grab random liquid stocks
    if df['Close'].iloc[-1] > 10 and df['Volume'].iloc[-20:].mean() > 1_000_000:
        res = evaluate_medium_base(t, pre_df=df)
        if res:
            print(f"Passed: {t}")
        count += 1
        if count > 500: break
print(f"Finished evaluating {count} liquid stocks.")
