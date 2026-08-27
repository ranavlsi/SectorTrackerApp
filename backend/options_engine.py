import os
import json
import time
import requests
import datetime
from dotenv import load_dotenv

load_dotenv('/Users/amitkumar/Desktop/SectorTrackerApp/backend/.env')

try:
    from yahooquery import Ticker
except ImportError:
    print("yahooquery not found.")
    exit(1)

STATE_FILE = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/options_alerts_sent.json'

def load_sent_alerts():
    today = datetime.datetime.now().strftime('%Y-%m-%d')
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r') as f:
                state = json.load(f)
                if state.get("date") == today:
                    return state.get("sent", [])
    except Exception:
        pass
    return []

def save_sent_alert(alert_key):
    today = datetime.datetime.now().strftime('%Y-%m-%d')
    try:
        sent = load_sent_alerts()
        if alert_key not in sent:
            sent.append(alert_key)
            
        with open(STATE_FILE, 'w') as f:
            json.dump({"date": today, "sent": sent}, f)
    except Exception as e:
        print(f"Failed to save alert state: {e}")

def fire_options_alert(ticker, contract_type, strike, exp_date, vol, oi, ratio):
    payload = {
        "council": "🐋 OPTIONS WHALE",
        "ticker": ticker,
        "setup": f"🚨 HUGE {contract_type.upper()} SWEEP: Strike ${strike} expiring {exp_date}. Vol: {int(vol):,} vs OI: {int(oi):,} (Ratio: {ratio}x)",
        "color": "#3b82f6" if contract_type == 'call' else "#ef4444",
        "send_telegram": True
    }
    try:
        requests.post("http://127.0.0.1:5000/api/webhook_alert", json=payload, timeout=2)
    except Exception as e:
        print(f"Webhook error for {ticker}: {e}")

def run_options_scanner():
    print(f"Starting 🐋 Background Options Whale Scanner...")
    
    # Load universe from structural_levels or daily parquet
    tickers = ["AAPL", "TSLA", "NVDA", "AMD", "META", "AMZN", "MSFT", "GOOGL", "SPY", "QQQ", "PLTR", "SOFI"]
    try:
        if os.path.exists('/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/structural_levels.json'):
            with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/structural_levels.json', 'r') as f:
                st_data = json.load(f)
                levels = st_data.get('levels', {})
                if levels:
                    tickers = list(levels.keys())[:50] # Top 50 to avoid massive rate limits
    except Exception as e:
        pass

    sent_alerts = load_sent_alerts()

    for ticker in tickers:
        try:
            stock = Ticker(ticker)
            chain_df = stock.option_chain
            
            if chain_df is None or chain_df.empty:
                continue
                
            chain_df = chain_df.reset_index()
            
            # Filter for near-term expirations (0DTE to 14 days)
            now = datetime.datetime.now()
            max_date = now + datetime.timedelta(days=14)
            
            expirations = chain_df['expiration'].unique()
            valid_exps = []
            for e in expirations:
                if isinstance(e, str):
                    try:
                        dt = datetime.datetime.strptime(e, "%Y-%m-%d")
                    except ValueError:
                        continue
                else:
                    dt = e.to_pydatetime()
                
                if dt <= max_date:
                    valid_exps.append(e)
            
            if not valid_exps:
                continue
                
            options_df = chain_df[chain_df['expiration'].isin(valid_exps)]
            
            for index, row in options_df.iterrows():
                vol = row.get('volume', 0)
                oi = row.get('openInterest', 0)
                strike = row.get('strike', 0)
                exp = row.get('expiration', '')
                opt_type = row.get('optionType', '')
                
                import pandas as pd
                if pd.isna(vol) or pd.isna(oi):
                    continue
                    
                vol = float(vol)
                oi = float(oi)
                
                if oi > 0:
                    ratio = vol / oi
                    # Algorithmic Parameters based on research:
                    # 1. Volume must be at least 2.5x the existing open interest
                    # 2. Minimum premium/volume threshold (e.g. at least 500 contracts) to avoid noise in illiquid strikes
                    if ratio > 2.5 and vol > 500:
                        alert_key = f"{ticker}_{opt_type}_{strike}_{exp}"
                        if alert_key in sent_alerts:
                            continue # Already alerted today
                            
                        fire_options_alert(ticker, opt_type, strike, exp, vol, oi, round(ratio, 2))
                        print(f"🔥 WHALE DETECTED: {ticker} {opt_type} {strike} exp {exp} | Vol: {vol} OI: {oi} Ratio: {ratio}")
                        
                        save_sent_alert(alert_key)
                        sent_alerts.append(alert_key) # Update local cache immediately
                        
        except Exception as e:
            print(f"Error checking options for {ticker}: {e}")
            
    print("Options scan complete.")

if __name__ == "__main__":
    run_options_scanner()
