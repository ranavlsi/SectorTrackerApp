import os
import sys
import time
import argparse
from datetime import datetime, timedelta
import requests
import pandas as pd
import duckdb
from dotenv import load_dotenv

from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetAssetsRequest
from alpaca.trading.enums import AssetClass
from alpaca.data.timeframe import TimeFrame
from alpaca.data.enums import DataFeed

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PARQUET_FILE = os.path.join(DATA_DIR, "daily_ohlcv.parquet")

def get_all_tickers(api_key, secret_key):
    """
    Robust ticker retrieval with 4-layer fallback.
    Bypasses alpaca-py Pydantic enum validation crashes (e.g. newly introduced exchanges like TXSE).
    """
    headers = {
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": secret_key
    }
    
    # 1. Primary: Direct REST call to Alpaca Paper / Live API (immune to Pydantic enum mismatches)
    endpoints = [
        "https://paper-api.alpaca.markets/v2/assets",
        "https://api.alpaca.markets/v2/assets"
    ]
    
    for url in endpoints:
        try:
            resp = requests.get(url, params={"status": "active", "asset_class": "us_equity"}, headers=headers, timeout=15)
            if resp.status_code == 200:
                assets = resp.json()
                tickers = [
                    a["symbol"] for a in assets 
                    if a.get("tradable") and a.get("status") == "active"
                    and "-" not in a.get("symbol", "") and "." not in a.get("symbol", "")
                ]
                if len(tickers) > 1000:
                    print(f"Successfully retrieved {len(tickers)} active tickers via Alpaca REST API ({url}).")
                    return sorted(list(set(tickers)))
        except Exception as e:
            print(f"REST fetch from {url} failed: {e}")

    # 2. Secondary fallback: alpaca-py TradingClient
    try:
        trading_client = TradingClient(api_key, secret_key)
        search_params = GetAssetsRequest(asset_class=AssetClass.US_EQUITY)
        assets = trading_client.get_all_assets(search_params)
        tickers = [
            asset.symbol for asset in assets 
            if asset.tradable and str(asset.status).upper() == 'ACTIVE'
            and '-' not in asset.symbol and '.' not in asset.symbol
        ]
        if len(tickers) > 1000:
            print(f"Successfully retrieved {len(tickers)} active tickers via alpaca-py TradingClient.")
            return sorted(list(set(tickers)))
    except Exception as e:
        print(f"alpaca-py TradingClient fetch failed: {e}")

    # 3. Tertiary fallback: Read distinct tickers from existing daily_ohlcv.parquet
    if os.path.exists(PARQUET_FILE):
        try:
            conn = duckdb.connect()
            rows = conn.execute(f"SELECT DISTINCT Ticker FROM '{PARQUET_FILE}'").fetchall()
            tickers = [r[0] for r in rows if r[0] and '-' not in r[0] and '.' not in r[0]]
            if len(tickers) > 500:
                print(f"Loaded {len(tickers)} fallback tickers from existing Lakehouse ({PARQUET_FILE}).")
                return sorted(list(set(tickers)))
        except Exception as e:
            print(f"Lakehouse fallback ticker load failed: {e}")

    # 4. Quaternary fallback: Read from all_us_optionable_stocks.json
    opt_file = os.path.join(DATA_DIR, "all_us_optionable_stocks.json")
    if os.path.exists(opt_file):
        try:
            import json
            with open(opt_file) as f:
                data = json.load(f)
                if isinstance(data, list):
                    return sorted(list(set(data)))
        except Exception as e:
            print(f"JSON fallback failed: {e}")

    return []

def update_database(full_rebuild=False, target_tickers=None, force=False):
    print("=" * 60)
    print("Initializing Lakehouse Database Updater...")
    print("=" * 60)
    api_key = os.getenv("APCA_API_KEY_ID")
    secret_key = os.getenv("APCA_API_SECRET_KEY")
    
    if not api_key or not secret_key:
        print("Missing Alpaca API Keys in .env")
        return False
        
    client = StockHistoricalDataClient(api_key, secret_key)
    
    today = datetime.today()
    is_incremental = False
    start_date = today - timedelta(days=1460) # 4 years default for base analysis
    end_date = today
    
    if os.path.exists(PARQUET_FILE) and not full_rebuild:
        try:
            conn = duckdb.connect()
            stats = conn.execute(f"SELECT COUNT(*), MIN(Date), MAX(Date) FROM '{PARQUET_FILE}'").fetchone()
            total_rows, min_date, max_date = stats
            print(f"Existing Lakehouse found: {total_rows:,} rows | Range: {min_date} to {max_date}")
            
            if max_date is not None:
                days_behind = (today.date() - max_date.date()).days
                print(f"Lakehouse is {days_behind} day(s) behind current date ({today.strftime('%Y-%m-%d')}).")
                
                if days_behind == 0 and not force:
                    print("Lakehouse already has data for today! Use --force to re-download.")
                    return True
                
                # Fetch starting 2 days prior to max_date to catch any post-settlement revisions & new bars
                start_date = max_date - timedelta(days=2)
                is_incremental = True
                print(f"Running INCREMENTAL update: fetching {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
        except Exception as e:
            print(f"Warning: could not inspect existing parquet: {e}. Falling back to full download.")
            is_incremental = False

    if not is_incremental:
        print(f"Running FULL rebuild: fetching 4 years ({start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')})")

    # Get tickers
    if target_tickers:
        tickers = target_tickers
    else:
        tickers = get_all_tickers(api_key, secret_key)
        # Merge existing parquet tickers (ensures ETFs/indices like SPY, QQQ, DIA are retained)
        if os.path.exists(PARQUET_FILE):
            try:
                conn = duckdb.connect()
                existing = [r[0] for r in conn.execute(f"SELECT DISTINCT Ticker FROM '{PARQUET_FILE}'").fetchall() if r[0]]
                tickers = sorted(list(set(tickers).union(set(existing))))
            except Exception:
                pass
                
    tickers = [t for t in tickers if '-' not in t and '.' not in t]
    
    if not tickers:
        print("ERROR: No valid tickers found! Aborting.")
        return False
        
    total_chunks = (len(tickers) + 249) // 250
    print(f"Beginning download for {len(tickers)} tickers across {total_chunks} chunks...")
    
    chunk_size = 250
    all_dfs = []
    failed_chunks = 0
    t0 = time.time()
    
    for i in range(0, len(tickers), chunk_size):
        chunk = tickers[i:i+chunk_size]
        chunk_num = (i // chunk_size) + 1
        
        try:
            request_params = StockBarsRequest(
                symbol_or_symbols=chunk,
                timeframe=TimeFrame.Day,
                start=start_date,
                end=end_date,
                feed=DataFeed.SIP
            )
            bars = client.get_stock_bars(request_params)
            
            if bars and hasattr(bars, 'df') and not bars.df.empty:
                df = bars.df.reset_index()
                df = df.rename(columns={
                    'symbol': 'Ticker',
                    'timestamp': 'Date',
                    'open': 'Open',
                    'high': 'High',
                    'low': 'Low',
                    'close': 'Close',
                    'volume': 'Volume'
                })
                cols_to_keep = ['Date', 'Ticker', 'Open', 'High', 'Low', 'Close', 'Volume']
                df = df[cols_to_keep]
                all_dfs.append(df)
            
            if chunk_num % 10 == 0 or chunk_num == total_chunks:
                print(f"Processed chunk {chunk_num}/{total_chunks} ({len(chunk)} tickers)...")
                
        except Exception as e:
            print(f"Error on chunk {chunk_num}: {e}")
            failed_chunks += 1
            
        time.sleep(0.1)
        
    elapsed = time.time() - t0
    print(f"Download phase finished in {elapsed:.1f}s. Fetched chunks: {len(all_dfs)}/{total_chunks} (Failed: {failed_chunks})")
    
    if not all_dfs:
        print("ERROR: Failed to download any data from Alpaca.")
        return False
        
    new_bars_df = pd.concat(all_dfs, ignore_index=True)
    new_bars_df['Date'] = pd.to_datetime(new_bars_df['Date']).dt.tz_localize(None)
    print(f"Total new/updated rows downloaded: {len(new_bars_df):,}")
    
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
        
    temp_file = os.path.join(DATA_DIR, "daily_ohlcv_tmp.parquet")
    
    try:
        conn = duckdb.connect()
        conn.register("new_bars_df", new_bars_df)
        
        if is_incremental and os.path.exists(PARQUET_FILE):
            print("Atomic upsert: Merging new bars with existing Lakehouse...")
            upsert_sql = f"""
                COPY (
                    WITH combined AS (
                        SELECT * FROM new_bars_df
                        UNION ALL
                        SELECT e.* FROM read_parquet('{PARQUET_FILE}') e
                        WHERE NOT EXISTS (
                            SELECT 1 FROM new_bars_df n
                            WHERE n.Ticker = e.Ticker AND CAST(n.Date AS DATE) = CAST(e.Date AS DATE)
                        )
                    )
                    SELECT * FROM combined ORDER BY Ticker, Date
                ) TO '{temp_file}' (FORMAT PARQUET)
            """
            conn.execute(upsert_sql)
        else:
            print("Writing full fresh Lakehouse parquet...")
            conn.execute(f"COPY (SELECT * FROM new_bars_df ORDER BY Ticker, Date) TO '{temp_file}' (FORMAT PARQUET)")
            
        # Atomic rename
        if os.path.exists(PARQUET_FILE):
            backup_file = os.path.join(DATA_DIR, "daily_ohlcv_backup.parquet")
            try:
                import shutil
                shutil.copy2(PARQUET_FILE, backup_file)
            except Exception:
                pass
                
        os.replace(temp_file, PARQUET_FILE)
        
        # Verify result
        final_stats = conn.execute(f"SELECT COUNT(*), COUNT(DISTINCT Ticker), MIN(Date), MAX(Date) FROM '{PARQUET_FILE}'").fetchone()
        print("=" * 60)
        print(f"SUCCESS! Lakehouse Parquet updated successfully.")
        print(f"Total Rows:    {final_stats[0]:,}")
        print(f"Total Tickers: {final_stats[1]:,}")
        print(f"Date Range:    {final_stats[2]} to {final_stats[3]}")
        print("=" * 60)
        return True
    except Exception as e:
        print(f"ERROR during parquet write/upsert: {e}")
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except Exception:
                pass
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Alpaca Daily OHLCV Lakehouse Updater")
    parser.add_argument("--full", action="store_true", help="Force full 4-year lakehouse rebuild")
    parser.add_argument("--force", action="store_true", help="Force update even if max date is today")
    parser.add_argument("--tickers", type=str, default=None, help="Comma-separated tickers for targeted update")
    
    args = parser.parse_args()
    
    target_tickers = None
    if args.tickers:
        target_tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
        
    update_database(full_rebuild=args.full, target_tickers=target_tickers, force=args.force)
