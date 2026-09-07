import duckdb
import pandas as pd
import json
import os
from yahooquery import Ticker as YQTicker

with open('/Users/amitkumar/Desktop/SectorTrackerApp/public/deepvue_results.json', 'r') as f:
    d = json.load(f)
    print(f"Leaders in json: {len(d['leaders'])}")

# Let's run a small test on top_candidates fetching
# Just 5 tickers
batch = ['NVDA', 'AAPL', 'MSFT', 'META', 'AMZN']
yq_t = YQTicker(batch, asynchronous=True)
            
batch_fin = yq_t.financial_data
print("batch_fin:", type(batch_fin))
batch_det = yq_t.summary_detail
print("batch_det:", type(batch_det))

hist_df = yq_t.history(period="max", interval="1mo")
print("hist_df:", type(hist_df))

