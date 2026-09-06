import duckdb
from volume_profile_scanner import evaluate_val_rejection
import pandas as pd

conn = duckdb.connect('/Users/amitkumar/Desktop/SectorTrackerApp/backend/market_data.duckdb')
df = conn.execute("SELECT Date, Open, High, Low, Close, Volume FROM daily_bars WHERE Ticker = 'RDDT' ORDER BY Date").fetchdf()
df = df.set_index('Date')

print("Columns:", df.columns)
print("Is Date in columns?", 'Date' in df.columns)
print("Is Date in index?", df.index.name == 'Date')

res = evaluate_val_rejection('RDDT', df=df, lookback=63)
print(res)

