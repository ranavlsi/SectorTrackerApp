import duckdb
import sys
from regression_channel_scanner import evaluate_regression_channel
from volume_profile_scanner import evaluate_val_rejection

lakehouse_path = "/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet"
query = f"SELECT * FROM read_parquet('{lakehouse_path}') ORDER BY Ticker, Date"
df = duckdb.query(query).to_df()
df.rename(columns={'Close':'Close', 'High':'High', 'Low':'Low', 'Open':'Open', 'Volume':'Volume'}, inplace=True)

tickers = df['Ticker'].unique()
reg_hits = []
val_hits = []

for t in tickers[:1000]: # just test first 1000 to save time
    t_df = df[df['Ticker'] == t].copy()
    
    reg = evaluate_regression_channel(t, df=t_df)
    if reg: reg_hits.append(reg)
        
    val = evaluate_val_rejection(t, df=t_df)
    if val: val_hits.append(val)

print(f"Regression Hits (first 1000): {len(reg_hits)}")
if reg_hits: print(reg_hits[:2])

print(f"VAL Hits (first 1000): {len(val_hits)}")
if val_hits: print(val_hits[:2])
