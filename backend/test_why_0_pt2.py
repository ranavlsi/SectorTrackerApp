import duckdb
import pandas as pd
from yahooquery import Ticker as YQTicker

batch = ['NVDA', 'AAPL']
yq_t = YQTicker(batch, asynchronous=True)
hist_df = yq_t.history(period="max", interval="1mo")
print(hist_df)
