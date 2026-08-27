import json
import time
import requests
import pandas as pd
from datetime import datetime
import pytz

import os

EXPERT_FILE = '/Users/amitkumar/Desktop/SectorTrackerApp/public/screener_results.json'
RS_FILE = '/Users/amitkumar/Desktop/SectorTrackerApp/public/rs_scanner_results.json'
SQUEEZE_FILE = '/Users/amitkumar/Desktop/SectorTrackerApp/public/squeeze_results.json'
ROLLING_CACHE_FILE = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/rolling_watch.json'
WEBHOOK_URL = 'http://127.0.0.1:5000/api/webhook_alert'

def get_target_tickers():
    now_ts = time.time()
    rolling_cache = {}
    
    if os.path.exists(ROLLING_CACHE_FILE):
        try:
            with open(ROLLING_CACHE_FILE, 'r') as f:
                rolling_cache = json.load(f)
        except:
            pass
            
    fresh_tickers = set()
    
    # 1. Expert Screener
    try:
        with open(EXPERT_FILE, 'r') as f:
            data = json.load(f)
        for cat, items in data.items():
            for item in items:
                if 'ticker' in item: fresh_tickers.add(item['ticker'])
    except: pass
    
    # 2. RS Line
    try:
        with open(RS_FILE, 'r') as f:
            data = json.load(f)
        for cat, items in data.items():
            for item in items:
                if 'ticker' in item: fresh_tickers.add(item['ticker'])
    except: pass
    
    # 3. Squeeze Radar
    try:
        with open(SQUEEZE_FILE, 'r') as f:
            data = json.load(f)
        for cat, items in data.items():
            for item in items:
                if 'ticker' in item: fresh_tickers.add(item['ticker'])
    except: pass
    
    # Update cache
    for t in fresh_tickers:
        rolling_cache[t] = now_ts
        
    # Prune older than 30 days (2592000 seconds)
    active_tickers = []
    keys_to_delete = []
    for t, ts in rolling_cache.items():
        if now_ts - ts > 2592000:
            keys_to_delete.append(t)
        else:
            active_tickers.append(t)
            
    for k in keys_to_delete:
        del rolling_cache[k]
        
    # Save cache
    os.makedirs(os.path.dirname(ROLLING_CACHE_FILE), exist_ok=True)
    with open(ROLLING_CACHE_FILE, 'w') as f:
        json.dump(rolling_cache, f)
        
    return active_tickers

def send_alert(ticker, setup_name, color="#f59e0b"):
    payload = {
        "council": "🎯 MASTER 30-DAY RADAR",
        "ticker": ticker,
        "setup": setup_name,
        "color": color,
        "send_telegram": True
    }
    try:
        requests.post(WEBHOOK_URL, json=payload, timeout=5)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Alert sent for {ticker}: {setup_name}")
    except Exception as e:
        print(f"Failed to send alert for {ticker}: {e}")

def monitor_loop():
    print("Starting Master 30-Day Rolling Monitor Agent...")
    from yahooquery import Ticker
    
    # Track which alerts have fired today to avoid spamming
    fired_alerts = set()
    
    while True:
        try:
            # Check if market is open (basic check, EST time)
            est = pytz.timezone('US/Eastern')
            now = datetime.now(est)
            if now.hour < 9 or (now.hour == 9 and now.minute < 30) or now.hour >= 16:
                print(f"[{now.strftime('%H:%M')}] Market closed. Sleeping for 5 minutes...")
                time.sleep(300)
                continue
                
            tickers = get_target_tickers()
            if not tickers:
                print("No target tickers found. Sleeping...")
                time.sleep(60)
                continue
                
            print(f"[{now.strftime('%H:%M:%S')}] Polling {len(tickers)} tickers from Rolling 30-Day Master Screener via Alpaca...")
            
            import os
            from dotenv import load_dotenv
            from alpaca.data.historical import StockHistoricalDataClient
            from alpaca.data.requests import StockBarsRequest
            from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
            from alpaca.data.enums import DataFeed
            from datetime import timedelta
            
            load_dotenv()
            api_key = os.getenv("APCA_API_KEY_ID")
            secret_key = os.getenv("APCA_API_SECRET_KEY")
            
            if not api_key or not secret_key:
                print("Missing Alpaca API Keys in .env")
                time.sleep(60)
                continue
                
            client = StockHistoricalDataClient(api_key, secret_key)
            
            alpaca_tickers = [t.replace('-', '.') for t in tickers]
            
            try:
                request_params = StockBarsRequest(
                    symbol_or_symbols=alpaca_tickers,
                    timeframe=TimeFrame(1, TimeFrameUnit.Minute),
                    start=now - timedelta(days=2),
                    end=now,
                    feed=DataFeed.IEX # Free tier
                )
                bars = client.get_stock_bars(request_params)
                if not bars or not hasattr(bars, 'df') or bars.df.empty:
                    time.sleep(60)
                    continue
                    
                df = bars.df.reset_index()
                df['symbol'] = df['symbol'].str.replace('.', '-')
                df = df.rename(columns={'symbol': 'Ticker', 'timestamp': 'Date', 'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'volume': 'Volume'})
                df = df.set_index(['Ticker', 'Date'])
            except Exception as e:
                print(f"Alpaca API error: {e}")
                time.sleep(60)
                continue
            
            for ticker in tickers:
                if ticker.upper() not in df.index.get_level_values('Ticker').str.upper():
                    continue
                    
                # Extract ticker data
                ticker_df = df.loc[ticker.upper() if ticker.upper() in df.index.levels[0] else ticker].copy()
                if len(ticker_df) < 5: continue
                
                # Convert index to EST timezone if not already
                if ticker_df.index.tz is None:
                    ticker_df.index = ticker_df.index.tz_localize('UTC').tz_convert('US/Eastern')
                else:
                    ticker_df.index = ticker_df.index.tz_convert('US/Eastern')
                
                curr_candle = ticker_df.iloc[-1]
                curr_c = curr_candle['Close']
                curr_v = curr_candle['Volume']
                
                # VWAP Calculation
                ticker_df['Typical'] = (ticker_df['High'] + ticker_df['Low'] + ticker_df['Close']) / 3
                ticker_df['CumVol'] = ticker_df['Volume'].cumsum()
                ticker_df['CumVolPrice'] = (ticker_df['Typical'] * ticker_df['Volume']).cumsum()
                ticker_df['VWAP'] = ticker_df['CumVolPrice'] / ticker_df['CumVol']
                
                curr_vwap = ticker_df['VWAP'].iloc[-1]
                
                # Volume metrics
                avg_vol_5m = ticker_df['Volume'].iloc[-6:-1].mean()
                
                # 1. VWAP Momentum Breakout
                # Price just crossed above VWAP, with volume > 250% of the recent 5-min average
                alert_key_vwap = f"{ticker}_vwap"
                if alert_key_vwap not in fired_alerts:
                    if curr_c > curr_vwap and ticker_df['Close'].iloc[-2] <= ticker_df['VWAP'].iloc[-2]:
                        if curr_v > (avg_vol_5m * 2.5) and curr_v > 5000:
                            send_alert(ticker, f"Surged above VWAP with {curr_v/max(1, avg_vol_5m):.1f}x Vol", "#10b981")
                            fired_alerts.add(alert_key_vwap)
                
                # 2. ORB Reclaim
                # Price drops below the 30-minute ORB high, then reclaims it.
                alert_key_orb = f"{ticker}_orb"
                if alert_key_orb not in fired_alerts:
                    # Get first 30 mins
                    start_time = ticker_df.index[0].replace(hour=9, minute=30, second=0, microsecond=0)
                    end_orb_time = start_time.replace(hour=10, minute=0)
                    
                    orb_data = ticker_df[(ticker_df.index >= start_time) & (ticker_df.index <= end_orb_time)]
                    if not orb_data.empty and len(ticker_df) > len(orb_data):
                        orb_high = orb_data['High'].max()
                        if curr_c > orb_high and ticker_df['Close'].iloc[-2] <= orb_high:
                            send_alert(ticker, f"Reclaimed 30-Min ORB High (${orb_high:.2f})", "#3b82f6")
                            fired_alerts.add(alert_key_orb)

                # 3. Afternoon HOD Breakout
                # Between 1:00 PM and 4:00 PM, stock breaks the absolute highest point of the day
                alert_key_hod = f"{ticker}_hod"
                if alert_key_hod not in fired_alerts and now.hour >= 13:
                    hod = ticker_df['High'].iloc[:-1].max()
                    if curr_c > hod:
                        send_alert(ticker, f"Afternoon HOD Breakout! Clearing ${hod:.2f}", "#8b5cf6")
                        fired_alerts.add(alert_key_hod)

        except Exception as e:
            print(f"Error in monitor loop: {e}")
            
        # Sleep for 60 seconds
        time.sleep(60)

if __name__ == "__main__":
    monitor_loop()
