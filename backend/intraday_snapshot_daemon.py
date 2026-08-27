import os
import time
import pandas as pd
import duckdb
from datetime import datetime, timezone
import pytz
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockLatestBarRequest
from dotenv import load_dotenv

load_dotenv('/Users/amitkumar/Desktop/SectorTrackerApp/backend/.env')

API_KEY = os.getenv("APCA_API_KEY_ID")
SECRET_KEY = os.getenv("APCA_API_SECRET_KEY")

if not API_KEY or not SECRET_KEY:
    raise ValueError("Missing Alpaca API credentials in .env")

client = StockHistoricalDataClient(API_KEY, SECRET_KEY)

DATA_DIR = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data'
DAILY_PARQUET = os.path.join(DATA_DIR, 'daily_ohlcv.parquet')
INTRADAY_PARQUET = os.path.join(DATA_DIR, 'intraday_live.parquet')

def is_market_open():
    """Returns True if it's currently between 9:30 AM and 4:00 PM EST on a weekday."""
    eastern = pytz.timezone('US/Eastern')
    now = datetime.now(eastern)
    
    if now.weekday() >= 5: # Saturday or Sunday
        return False
        
    market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now.replace(hour=16, minute=0, second=0, microsecond=0)
    
    return market_open <= now <= market_close

def get_master_ticker_list():
    """Reads the master list of 12,000 tickers from the daily lakehouse."""
    if not os.path.exists(DAILY_PARQUET):
        return []
    df = duckdb.query(f"SELECT DISTINCT Ticker FROM read_parquet('{DAILY_PARQUET}')").to_df()
    return df['Ticker'].tolist()

def chunk_list(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

def fetch_market_snapshot(tickers):
    """Fetches the latest minute bar for all tickers in ~3 seconds using Alpaca."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching Live Snapshot for {len(tickers)} stocks...")
    
    all_data = []
    chunk_size = 1000
    
    for i, chunk in enumerate(chunk_list(tickers, chunk_size)):
        retries = 3
        while retries > 0:
            try:
                req = StockLatestBarRequest(symbol_or_symbols=chunk)
                bars = client.get_stock_latest_bar(req)
                
                for symbol, bar in bars.items():
                    if bar is not None:
                        all_data.append({
                            'Ticker': symbol,
                            'Close': float(bar.close),
                            'High': float(bar.high),
                            'Low': float(bar.low),
                            'Open': float(bar.open),
                            'Volume': int(bar.volume),
                            'Timestamp': bar.timestamp.isoformat()
                        })
                break # Success, exit retry loop
            except Exception as e:
                err_str = str(e).lower()
                print(f"Error on chunk {i} (retries left: {retries}): {e}")
                if "429" in err_str or "too many requests" in err_str:
                    time.sleep(15) # Longer backoff for rate limits
                else:
                    time.sleep(5) # Standard Backoff
                retries -= 1
        time.sleep(2.0) # Prevent hitting Alpaca's rate limit

            
    if not all_data:
        return None
        
    df = pd.DataFrame(all_data)
    return df

def run_daemon():
    print("Initializing Intraday True-Live Snapshot Daemon...")
    
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        
    tickers = get_master_ticker_list()
    if not tickers:
        print(f"Error: {DAILY_PARQUET} not found. Please run db_updater.py first.")
        return
        
    print(f"Loaded {len(tickers)} symbols from Lakehouse.")
    print("Daemon will pull market-wide snapshots every 60 seconds during open hours.")
    
    last_15m_run = 0
    
    while True:
        if is_market_open():
            t0 = time.time()
            df = fetch_market_snapshot(tickers)
            
            if df is not None and not df.empty:
                df.to_parquet(INTRADAY_PARQUET, index=False)
                t1 = time.time()
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved {len(df)} live bars to {INTRADAY_PARQUET} in {t1-t0:.2f}s.")
                
                # Trigger the live market scanner to instantly analyze the snapshot
                import subprocess
                subprocess.Popen(['python3', '/Users/amitkumar/Desktop/SectorTrackerApp/backend/live_market_scanner.py'])
                subprocess.Popen(['python3', '/Users/amitkumar/Desktop/SectorTrackerApp/backend/intraday_engine.py'])            
            # --- 15-Minute Engine Triggers ---
            current_time = time.time()
            if current_time - last_15m_run >= 900:  # 900 seconds = 15 minutes
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Triggering 15-Minute Engines (Options, Darkpool, RRG)...")
                try:
                    subprocess.Popen(['python3', '/Users/amitkumar/Desktop/SectorTrackerApp/backend/options_engine.py'])
                    subprocess.Popen(['python3', '/Users/amitkumar/Desktop/SectorTrackerApp/backend/sector_data_api.py'])
                except Exception as e:
                    print(f"Error triggering engines: {e}")
                last_15m_run = current_time

        else:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Market closed. Sleeping...")
            
        time.sleep(60)

if __name__ == "__main__":
    run_daemon()
