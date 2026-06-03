import sys
sys.path.append('backend')
from premarket_gappers import *

client = StockHistoricalDataClient(api_key, secret_key)
alpaca_universe = [sym.replace('-', '.') for sym in UNIVERSE]
req = StockSnapshotRequest(symbol_or_symbols=alpaca_universe)
snapshots = client.get_stock_snapshot(req)

gaps = []
for ticker, snap in snapshots.items():
    if snap.previous_daily_bar and snap.latest_trade:
        prev_close = snap.previous_daily_bar.close
        curr_price = snap.latest_trade.price
        if prev_close > 5.0:
            gap_pct = ((curr_price - prev_close) / prev_close) * 100
            if gap_pct > 0:
                gaps.append((ticker, gap_pct, curr_price, prev_close, snap.latest_trade.size))
                
top_5 = sorted(gaps, key=lambda x: x[1], reverse=True)[:5]

for i, (ticker, gap_pct, curr_price, prev_close, last_size) in enumerate(top_5):
    print(f"{i+1}. {ticker} (+{gap_pct:.1f}%) @ ${curr_price:.2f} (Prev Close: ${prev_close:.2f})")
