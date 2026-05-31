from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetAssetsRequest
from alpaca.trading.enums import AssetClass
from alpaca.data.timeframe import TimeFrame
from alpaca.data.enums import DataFeed
from dotenv import load_dotenv
import os
import pandas as pd
from datetime import datetime, timedelta
import urllib.request
import io
import time

load_dotenv()

def get_all_tickers(api_key, secret_key):
    try:
        trading_client = TradingClient(api_key, secret_key)
        search_params = GetAssetsRequest(asset_class=AssetClass.US_EQUITY)
        assets = trading_client.get_all_assets(search_params)
        # Filter to only active and tradable US equities (ignore crypto/OTC if any slip in)
        tickers = [asset.symbol for asset in assets if asset.tradable and asset.status.name == 'ACTIVE']
        return tickers
    except Exception as e:
        print(f"Error fetching tickers from Alpaca: {e}")
        return []

def update_database():
    print("Initializing Database Updater...")
    api_key = os.getenv("APCA_API_KEY_ID")
    secret_key = os.getenv("APCA_API_SECRET_KEY")
    
    if not api_key or not secret_key:
        print("Missing Alpaca API Keys in .env")
        return
        
    client = StockHistoricalDataClient(api_key, secret_key)
    
    # We only need 2 years of data for the 200 SMA
    end_date = datetime.today()
    start_date = end_date - timedelta(days=730)
    
    tickers = get_all_tickers(api_key, secret_key)
    # Further sanitize: no hyphens or dots (warrants/preferred) just in case
    tickers = [t for t in tickers if '-' not in t and '.' not in t]
    
    print(f"Found {len(tickers)} valid Alpaca tickers. Beginning bulk download...")
    
    chunk_size = 250
    all_dfs = []
    
    for i in range(0, len(tickers), chunk_size):
        chunk = tickers[i:i+chunk_size]
        print(f"Fetching chunk {i} to {i+chunk_size}...")
        
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
                # Rename columns to standard yfinance uppercase format to minimize scanner refactoring
                df = df.rename(columns={
                    'symbol': 'Ticker',
                    'timestamp': 'Date',
                    'open': 'Open',
                    'high': 'High',
                    'low': 'Low',
                    'close': 'Close',
                    'volume': 'Volume'
                })
                # Drop extra alpaca columns
                cols_to_keep = ['Date', 'Ticker', 'Open', 'High', 'Low', 'Close', 'Volume']
                df = df[cols_to_keep]
                all_dfs.append(df)
        except Exception as e:
            print(f"Error on chunk {i}: {e}")
            
        time.sleep(0.5) # Be gentle to API
        
    if not all_dfs:
        print("Failed to download any data.")
        return
        
    master_df = pd.concat(all_dfs, ignore_index=True)
    # Ensure Date is timezone naive to save to parquet
    master_df['Date'] = pd.to_datetime(master_df['Date']).dt.tz_localize(None)
    
    print(f"Download complete! Total rows: {len(master_df)}")
    
    parquet_path = os.path.join(os.path.dirname(__file__), "data")
    if not os.path.exists(parquet_path):
        os.makedirs(parquet_path)
        
    file_path = os.path.join(parquet_path, "daily_ohlcv.parquet")
    master_df.to_parquet(file_path)
    print(f"Successfully saved to DuckDB/Parquet Lakehouse at {file_path}")

if __name__ == "__main__":
    update_database()
