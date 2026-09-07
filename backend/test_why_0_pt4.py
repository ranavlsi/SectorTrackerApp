import duckdb
from yahooquery import Ticker as YQTicker
batch = ['NVDA', 'AAPL']
yq_t = YQTicker(batch)
print(yq_t.financial_data)
