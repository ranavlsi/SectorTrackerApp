import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
import time
from datetime import datetime
import pytz

import warnings
warnings.filterwarnings('ignore')

from intraday_engine import UNIVERSE

OUTPUT_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/structural_levels.json'

def fetch_key_levels():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Generating Key Structural Levels for {len(UNIVERSE)} stocks...")
    
    levels_cache = {}
    
    # 1. Fetch Daily Data in Bulk (Last 3 months to be safe for monthly calculations)
    tickers_str = " ".join(UNIVERSE)
    df_daily = yf.download(tickers_str, period="3mo", interval="1d", group_by="ticker", threads=True, auto_adjust=True, progress=False)
    
    for ticker in UNIVERSE:
        try:
            if len(UNIVERSE) == 1:
                stock_data = df_daily
            else:
                stock_data = df_daily[ticker].copy() if ticker in df_daily else pd.DataFrame()
                
            if stock_data.empty or len(stock_data) < 5:
                continue
                
            # Drop NaN rows where market might have been closed
            stock_data = stock_data.dropna(subset=['High', 'Low'])
            
            # --- Previous Day ---
            if len(stock_data) >= 2:
                pdh = float(stock_data['High'].iloc[-2])
                pdl = float(stock_data['Low'].iloc[-2])
            else:
                pdh, pdl = None, None
                
            # --- Previous Week ---
            # Resample to weekly
            weekly_data = stock_data.resample('W-FRI').agg({'High': 'max', 'Low': 'min'}).dropna()
            if len(weekly_data) >= 2:
                # The very last row might be the current incomplete week. 
                # To be absolutely sure, we use the 2nd to last row as "Previous Week".
                pwh = float(weekly_data['High'].iloc[-2])
                pwl = float(weekly_data['Low'].iloc[-2])
            else:
                pwh, pwl = None, None
                
            # --- Previous Month ---
            # Resample to monthly
            monthly_data = stock_data.resample('M').agg({'High': 'max', 'Low': 'min'}).dropna()
            if len(monthly_data) >= 2:
                # 2nd to last row is previous month
                pmoh = float(monthly_data['High'].iloc[-2])
                pmol = float(monthly_data['Low'].iloc[-2])
            else:
                pmoh, pmol = None, None
                
            # Initialize with None for PMH/PML, we will fetch them next
            levels_cache[ticker] = {
                "PDH": pdh, "PDL": pdl,
                "PWH": pwh, "PWL": pwl,
                "PMoH": pmoh, "PMoL": pmol,
                "PMH": None, "PML": None
            }
            
        except Exception as e:
            pass

    # 2. Fetch Premarket Data using 1m bars
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching Premarket Data...")
    try:
        # Fetch 2 days of 1m data with prepost to get today's premarket
        df_1m = yf.download(tickers_str, period="2d", interval="1m", group_by="ticker", prepost=True, threads=True, progress=False)
        
        today_date = datetime.now(pytz.timezone('US/Eastern')).strftime('%Y-%m-%d')
        
        for ticker in UNIVERSE:
            try:
                if ticker not in levels_cache:
                    continue
                    
                if len(UNIVERSE) == 1:
                    m1_data = df_1m
                else:
                    m1_data = df_1m[ticker].copy() if ticker in df_1m else pd.DataFrame()
                    
                if m1_data.empty:
                    continue
                    
                m1_data = m1_data.dropna(subset=['High', 'Low'])
                
                if m1_data.index.tz is None:
                    m1_data.index = m1_data.index.tz_localize('UTC').tz_convert('US/Eastern')
                else:
                    m1_data.index = m1_data.index.tz_convert('US/Eastern')
                
                # Filter for TODAY
                today_data = m1_data[m1_data.index.strftime('%Y-%m-%d') == today_date]
                
                # Filter for Premarket: 4:00 AM to 9:30 AM
                pm_data = today_data.between_time('04:00', '09:29')
                
                if not pm_data.empty:
                    pmh = float(pm_data['High'].max())
                    pml = float(pm_data['Low'].min())
                    levels_cache[ticker]["PMH"] = pmh
                    levels_cache[ticker]["PML"] = pml
            except Exception as e:
                pass
    except Exception as e:
        print(f"Failed to fetch premarket 1m data: {e}")

    # 3. Save to Cache
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump({"last_updated": datetime.now().isoformat(), "levels": levels_cache}, f)
        
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved {len(levels_cache)} structural levels to {OUTPUT_PATH}")

if __name__ == "__main__":
    fetch_key_levels()
