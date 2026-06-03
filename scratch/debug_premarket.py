import sys
sys.path.append('backend')
from premarket_gappers import *

client = StockHistoricalDataClient(api_key, secret_key)
alpaca_universe = [sym.replace('-', '.') for sym in UNIVERSE]
req = StockSnapshotRequest(symbol_or_symbols=alpaca_universe)
snapshots = client.get_stock_snapshot(req)

for ticker, snap in list(snapshots.items())[:3]:
    if snap.latest_trade:
        print(f"{ticker} Latest Trade Time: {snap.latest_trade.timestamp}")
