import duckdb
import sys
from volume_profile_scanner import evaluate_val_rejection, calculate_volume_profile

lakehouse_path = "/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet"
query = f"SELECT * FROM read_parquet('{lakehouse_path}') WHERE Ticker='RDDT' ORDER BY Date"
df = duckdb.query(query).to_df()
df.rename(columns={'Close':'Close', 'High':'High', 'Low':'Low', 'Open':'Open', 'Volume':'Volume'}, inplace=True)

vp = calculate_volume_profile(df.iloc[-63:], bins=100, va_pct=0.70)
print(vp)
res = evaluate_val_rejection("RDDT", df=df)
print(res)
