import sys
import time
import duckdb
sys.path.append("/Users/amitkumar/Desktop/SectorTrackerApp/backend")

from long_base_scanner import evaluate_long_base, evaluate_medium_base
from pending_breakout_engine import detect_pending_breakout
from qullamaggie_engine import evaluate_qullamaggie_setup

lakehouse_path = "/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet"
lake_df = duckdb.query(f"SELECT * FROM read_parquet('{lakehouse_path}') ORDER BY Date").to_df()
grouped = lake_df.groupby('Ticker')

ticker = "AAPL"
ticker_df = grouped.get_group(ticker).set_index('Date').dropna()

t0 = time.time()
evaluate_long_base(ticker, pre_df=ticker_df)
print(f"evaluate_long_base: {time.time() - t0:.4f}s")

t0 = time.time()
evaluate_medium_base(ticker, pre_df=ticker_df)
print(f"evaluate_medium_base: {time.time() - t0:.4f}s")

t0 = time.time()
detect_pending_breakout(ticker, pre_df=ticker_df)
print(f"detect_pending_breakout: {time.time() - t0:.4f}s")

t0 = time.time()
evaluate_qullamaggie_setup(ticker, pre_df=ticker_df)
print(f"evaluate_qullamaggie_setup: {time.time() - t0:.4f}s")
