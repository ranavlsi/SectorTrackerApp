import duckdb
import pandas as pd
import json
from datetime import datetime
import os

INTRADAY_PARQUET = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/intraday_live.parquet'
OUTPUT_JSON = '/Users/amitkumar/Desktop/SectorTrackerApp/public/live_market_alerts.json'

def run_live_scan():
    if not os.path.exists(INTRADAY_PARQUET):
        return
        
    # Read the latest 1-minute snapshot for all 12,000 stocks
    query = f"SELECT * FROM read_parquet('{INTRADAY_PARQUET}')"
    df = duckdb.query(query).to_df()
    
    alerts = []
    
    for _, row in df.iterrows():
        try:
            # Simple Intraday Momentum Logic for Live 1-Minute Snapshots
            # Look for massive volume spikes or large spread in the latest 1-minute candle
            
            ticker = row['Ticker']
            vol = row['Volume']
            open_p = row['Open']
            close_p = row['Close']
            
            if open_p == 0: continue
            
            # % Move in the last minute
            pct_move = ((close_p - open_p) / open_p) * 100
            
            # If stock moved > 1% in a single minute and had > 50,000 volume in that minute
            if pct_move > 1.0 and vol > 50000:
                alerts.append({
                    "ticker": ticker,
                    "time": row['Timestamp'],
                    "price": float(close_p),
                    "pct_move": float(pct_move),
                    "volume_1m": int(vol),
                    "type": "Momentum Spike"
                })
        except Exception:
            pass
            
    # Sort by biggest move
    alerts = sorted(alerts, key=lambda x: x['pct_move'], reverse=True)
    
    # Save to JSON for the frontend
    with open(OUTPUT_JSON, 'w') as f:
        json.dump({"last_updated": datetime.now().isoformat(), "alerts": alerts}, f)
        
    if alerts:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Found {len(alerts)} Live Market Momentum Spikes!")

if __name__ == "__main__":
    run_live_scan()
