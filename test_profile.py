import duckdb, time, os, sys
import pandas as pd

lake_df = duckdb.query("SELECT * FROM read_parquet('backend/data/daily_ohlcv.parquet') ORDER BY Date").to_df()
lake_df = lake_df.sort_values('Date')
grouped = lake_df.groupby('Ticker')
tickers = list(grouped.groups.keys())[:20]

from backend.long_base_scanner import evaluate_long_base, evaluate_medium_base
from backend.pending_breakout_engine import detect_pending_breakout
from backend.qullamaggie_engine import evaluate_qullamaggie_setup

print('Starting benchmark...')
for ticker in tickers:
    t0 = time.time()
    ticker_df = grouped.get_group(ticker).set_index('Date')
    
    t1 = time.time()
    try: evaluate_long_base(ticker, pre_df=ticker_df)
    except Exception as e: pass
    t2 = time.time()
    
    try: evaluate_medium_base(ticker, pre_df=ticker_df)
    except Exception as e: pass
    t3 = time.time()
    
    try: detect_pending_breakout(ticker, pre_df=ticker_df)
    except Exception as e: pass
    t4 = time.time()
    
    try: evaluate_qullamaggie_setup(ticker, pre_df=ticker_df)
    except Exception as e: pass
    t5 = time.time()
    
    print(f"{ticker}: Prep {t1-t0:.3f} | LB {t2-t1:.3f} | MB {t3-t2:.3f} | PB {t4-t3:.3f} | QM {t5-t4:.3f} | Total {t5-t0:.3f}")

