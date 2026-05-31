from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from alpaca.data.enums import DataFeed
from dotenv import load_dotenv
import os
import pandas as pd
from datetime import datetime, timedelta

load_dotenv()

api_key = os.getenv("APCA_API_KEY_ID")
secret_key = os.getenv("APCA_API_SECRET_KEY")

print(f"API Key Length: {len(api_key) if api_key else 0}")
print(f"Secret Key Length: {len(secret_key) if secret_key else 0}")

try:
    client = StockHistoricalDataClient(api_key, secret_key)

    end_date = datetime.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=5)

    request_params = StockBarsRequest(
        symbol_or_symbols=["AAPL", "MSFT", "TSLA"],
        timeframe=TimeFrame.Day,
        start=start_date,
        end=end_date,
        feed=DataFeed.SIP # SIP gives full market data for delayed timeframe
    )

    bars = client.get_stock_bars(request_params)
    df = bars.df
    print("Success! Fetched rows:", len(df))
    print(df.head())
    
    # Reset index so 'symbol' and 'timestamp' become columns
    df = df.reset_index()
    # Save to test parquet
    df.to_parquet("test_alpaca.parquet")
    print("Successfully saved to test_alpaca.parquet")
    
except Exception as e:
    print(f"Error fetching data: {e}")
