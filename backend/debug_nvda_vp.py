import sys
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
import duckdb
import pandas as pd
from volume_profile_scanner import calculate_volume_profile

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') WHERE Ticker='NVDA' ORDER BY Date").to_df()
df = df.set_index('Date')

print("NVDA Last 15 rows:")
for idx, (d, row) in enumerate(df.iloc[-15:].iterrows()):
    print(f"  {d}: Open={row['Open']:.2f}, High={row['High']:.2f}, Low={row['Low']:.2f}, Close={row['Close']:.2f}, Vol={row['Volume']}")

date_series = df.index
last_date = pd.to_datetime(date_series[-1])
quarter = (last_date.month - 1) // 3 + 1
start_month = 3 * quarter - 2
start_of_quarter = pd.Timestamp(year=last_date.year, month=start_month, day=1)
fixed_df = df[pd.to_datetime(date_series) >= start_of_quarter].copy()

vp_fixed = calculate_volume_profile(fixed_df, bins=100, va_pct=0.70)
print(f"\nFixed Quarter (since {start_of_quarter.date()}):")
print(f"  Rows in quarter: {len(fixed_df)}")
print(f"  Fixed VAH: {vp_fixed['vah']:.2f}")
print(f"  Fixed POC: {vp_fixed['poc']:.2f}")
print(f"  Fixed VAL: {vp_fixed['val']:.2f}")

recent_63 = df.iloc[-63:].copy()
vp_rolling = calculate_volume_profile(recent_63, bins=100, va_pct=0.70)
print(f"\nRolling 63d:")
print(f"  Rolling VAH: {vp_rolling['vah']:.2f}")
print(f"  Rolling POC: {vp_rolling['poc']:.2f}")
print(f"  Rolling VAL: {vp_rolling['val']:.2f}")
