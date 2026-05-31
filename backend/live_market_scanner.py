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
        
    # Load the curated RS Line candidates
    rs_json_path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/rs_scanner_results.json'
    if not os.path.exists(rs_json_path):
        return
        
    with open(rs_json_path, 'r') as f:
        rs_data = json.load(f)
        
    candidates = rs_data.get('results', [])
    # Build a lookup table of breakout triggers
    trigger_map = {}
    for c in candidates:
        if c.get('pattern_status') == 'c_and_h' and 'pattern_details' in c:
            trigger = c['pattern_details'].get('breakout_trigger')
            if trigger:
                trigger_map[c['ticker']] = trigger
                
    if not trigger_map:
        return

    # Read the latest 1-minute snapshot for all 12,000 stocks
    query = f"SELECT * FROM read_parquet('{INTRADAY_PARQUET}')"
    df = duckdb.query(query).to_df()
    
    alerts = []
    
    for _, row in df.iterrows():
        ticker = row['Ticker']
        if ticker not in trigger_map:
            continue
            
        try:
            vol = row['Volume']
            close_p = row['Close']
            trigger_price = trigger_map[ticker]
            
            # Intraday Handle Breakout Alert Logic
            # If the current price is strictly above the handle resistance (right rim value)
            if close_p > trigger_price:
                pct_above = ((close_p - trigger_price) / trigger_price) * 100
                
                alerts.append({
                    "ticker": ticker,
                    "time": row['Timestamp'],
                    "price": float(close_p),
                    "trigger_price": float(trigger_price),
                    "pct_above": float(pct_above),
                    "volume_1m": int(vol),
                    "type": "🚀 Handle Breakout"
                })
        except Exception:
            pass
            
    # Sort by how far above the trigger they are
    alerts = sorted(alerts, key=lambda x: x['pct_above'], reverse=True)
    
    # Save to JSON for the frontend
    with open(OUTPUT_JSON, 'w') as f:
        json.dump({"last_updated": datetime.now().isoformat(), "alerts": alerts}, f)
        
    if alerts:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 🔥 {len(alerts)} Intraday Breakouts Detected!")

if __name__ == "__main__":
    run_live_scan()
