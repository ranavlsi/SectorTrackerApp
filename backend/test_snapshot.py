import os
import json
import time
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockSnapshotRequest
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("APCA_API_KEY_ID")
SECRET_KEY = os.getenv("APCA_API_SECRET_KEY")
client = StockHistoricalDataClient(API_KEY, SECRET_KEY)

# Load the 45 candidates from our RS Line Scanner
results_path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/rs_scanner_results.json'
with open(results_path, 'r') as f:
    data = json.load(f)

tickers = [item['ticker'] for item in data['results']]

print(f"Loaded {len(tickers)} highly curated RS Line candidates.")
print("Testing Alpaca's Multi-Symbol Snapshot Endpoint (Batching)...")
print("This consumes exactly 1 API call, completely bypassing the 200/min rate limit.\n")

t0 = time.time()

try:
    # Use the Snapshot request to get the latest quote, trade, and bar all at once
    req = StockSnapshotRequest(symbol_or_symbols=tickers)
    snapshots = client.get_stock_snapshot(req)
    t1 = time.time()
    
    print(f"SUCCESS! Retrieved live intraday data for all {len(tickers)} stocks in {t1 - t0:.2f} seconds.\n")
    
    print("Sample Data (First 3 Stocks):")
    for i, symbol in enumerate(tickers[:3]):
        snapshot = snapshots.get(symbol)
        if snapshot:
            print(f"\n--- {symbol} ---")
            print(f"Current Price: ${snapshot.latest_trade.price}")
            print(f"Today's Volume: {snapshot.daily_bar.volume:,}")
            print(f"Latest Minute Bar High: ${snapshot.minute_bar.high if snapshot.minute_bar else 'N/A'}")
            
except Exception as e:
    print(f"Error fetching snapshot: {e}")
