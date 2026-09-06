import duckdb
import sys
from volume_profile_scanner import calculate_volume_profile

lakehouse_path = "/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet"
query = f"SELECT * FROM read_parquet('{lakehouse_path}') WHERE Ticker='RDDT' ORDER BY Date"
df = duckdb.query(query).to_df()
df.rename(columns={'Close':'Close', 'High':'High', 'Low':'Low', 'Open':'Open', 'Volume':'Volume'}, inplace=True)

vp70 = calculate_volume_profile(df.iloc[-63:], bins=100, va_pct=0.70)
print(f"VAL at 70%: {vp70['val']}")

vp68 = calculate_volume_profile(df.iloc[-63:], bins=100, va_pct=0.68)
print(f"VAL at 68%: {vp68['val']}")


vp_q3 = calculate_volume_profile(df.iloc[-45:], bins=100, va_pct=0.70)
print(f"VAL for Q3 (45 days): {vp_q3['val']}")
