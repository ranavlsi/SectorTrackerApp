import yfinance as yf
import pandas as pd
import numpy as np
import os
import io
import urllib.request
import concurrent.futures
from datetime import datetime
import warnings
warnings.filterwarnings("ignore")

def get_all_tickers():
    url = "ftp://ftp.nasdaqtrader.com/symboldirectory/nasdaqtraded.txt"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = response.read().decode('utf-8')
        df = pd.read_csv(io.StringIO(data), sep='|')
        df = df[df['Test Issue'] == 'N']
        tickers = df['Symbol'].dropna().tolist()
        tickers = [t for t in tickers if isinstance(t, str) and len(t) > 0]
        tickers = [t.replace('$', '-').replace('.', '-') for t in tickers]
        return tickers
    except Exception as e:
        print(f"Error fetching tickers: {e}")
        return []

def calculate_volume_climax(df):
    """
    Returns (status, climax_date, climax_vol, message) or (None, None, 0, "")
    """
    if len(df) < 100: # Need enough history for a 50-day average
        return None, None, 0, ""
        
    df = df.copy()
    # Calculate 50-day average volume
    df['AvgVol50'] = df['Volume'].rolling(window=50).mean()
    
    # Find the Highest Volume Ever (in the 1 year dataset)
    # Exclude today from being the climax day, because we need it to consolidate AFTER the climax
    df_history = df.iloc[:-1] 
    
    if len(df_history) < 20:
        return None, None, 0, ""
        
    climax_date = df_history['Volume'].idxmax()
    climax_row = df_history.loc[climax_date]
    
    climax_idx = df.index.get_loc(climax_date)
    total_len = len(df)
    
    # 1. Trigger Check: Must be within the last 20 days (but at least 3 days ago to form a flag)
    days_since_climax = total_len - 1 - climax_idx
    if days_since_climax < 3 or days_since_climax > 20:
        return None, None, 0, ""
        
    # 2. Trigger Check: Must be a Green Candle (Accumulation)
    if float(climax_row['Close']) <= float(climax_row['Open']):
        return None, None, 0, ""
        
    # 3. Trigger Check: Volume must be > 3x the 50-day average
    climax_vol = float(climax_row['Volume'])
    avg_vol_at_climax = float(climax_row['AvgVol50'])
    
    if pd.isna(avg_vol_at_climax) or climax_vol < (avg_vol_at_climax * 3):
        return None, None, 0, ""
        
    # 4. Consolidation Check: Must hold 50% midpoint of the climax candle
    climax_high = float(climax_row['High'])
    climax_low = float(climax_row['Low'])
    midpoint = (climax_high + climax_low) / 2
    
    consolidation_df = df.iloc[climax_idx + 1:]
    
    for _, row in consolidation_df.iterrows():
        if float(row['Close']) < midpoint:
            return None, None, 0, "" # Gave back too much of the move
            
    # 5. Consolidation Check: Volume must be drying up
    avg_consolidation_vol = float(consolidation_df['Volume'].mean())
    if avg_consolidation_vol > (climax_vol * 0.5):
        return None, None, 0, "" # Volume is still too high, not flagging quietly
        
    # 6. Ready to Move Check: Coiled or near highs
    current_row = df.iloc[-1]
    prev_row = df.iloc[-2]
    
    current_close = float(current_row['Close'])
    consolidation_high = float(consolidation_df['High'].max())
    
    # Is it an Inside Day?
    is_inside_day = float(current_row['High']) < float(prev_row['High']) and float(current_row['Low']) > float(prev_row['Low'])
    
    # Is it within 2% of the consolidation high?
    is_near_high = current_close >= (consolidation_high * 0.98)
    
    if is_inside_day or is_near_high:
        reason = "Inside Day setup" if is_inside_day else f"Tight within 2% of highs"
        msg = f"{reason} | Climax Vol: {climax_vol/avg_vol_at_climax:.1f}x avg"
        return "READY", climax_date.strftime('%Y-%m-%d'), climax_vol, msg
        
    return None, None, 0, ""

def process_ticker(ticker, df):
    try:
        if len(df) < 100:
            return None
            
        status, climax_date, climax_vol, msg = calculate_volume_climax(df)
        
        if status:
            # Filter 1: 50-day Average Volume must be >= 5,000,000
            avg_vol_50 = df['Volume'].rolling(window=50).mean().iloc[-1]
            if pd.isna(avg_vol_50) or avg_vol_50 < 5000000:
                return None
                
            # Filter 2: Market Cap must be >= $1 Billion
            t = yf.Ticker(ticker)
            info = t.info
            mcap = info.get('marketCap', 0)
            
            if mcap < 1000000000:
                return None
                
            return {
                'Ticker': ticker,
                'Price': float(df['Close'].iloc[-1]),
                'Climax_Date': climax_date,
                'Message': f"{msg} | MCap: ${mcap/1e9:.1f}B | AvgVol: {avg_vol_50/1e6:.1f}M"
            }
    except Exception:
        pass
    return None

def generate_markdown(alerts):
    date_str = datetime.now().strftime("%B %d, %Y")
    report = f"## 🌋 Volume Climax Consolidation Scanner - {date_str}\n"
    report += "Stocks that printed their Highest Volume in a Year (massive accumulation) within the last 20 days, have quietly consolidated, and are tightly coiled for a breakout.\n\n"
    
    if not alerts:
        report += "*No Volume Climax setups perfectly coiled today.*\n\n"
    else:
        for a in alerts:
            report += f"### {a['Ticker']}\n"
            report += f"- **Current Price:** ${a['Price']:.2f}\n"
            report += f"- **Climax Date:** {a['Climax_Date']} (Held the 50% midpoint since this date)\n"
            report += f"- **Status:** {a['Message']}\n\n"
            
    report += "---\n\n"
    return report

def prepend_to_file(filepath, new_content):
    if not os.path.exists(filepath):
        with open(filepath, 'w') as f:
            f.write(new_content)
        return
    with open(filepath, 'r') as f:
        old_content = f.read()
    with open(filepath, 'w') as f:
        f.write(new_content + old_content)

def run_scanner():
    output_file = '/Users/amitkumar/Desktop/SectorTrackerApp/volume_climax_alerts.md'
    
    print("Loading data from Local DuckDB Lakehouse...")
    import duckdb
    parquet_path = os.path.join('/Users/amitkumar/Desktop/SectorTrackerApp/backend', 'data', 'daily_ohlcv.parquet')
    if not os.path.exists(parquet_path):
        print("Lakehouse not found. Please run db_updater.py first.")
        return
        
    query = f"SELECT * FROM read_parquet('{parquet_path}') ORDER BY Date"
    df_bulk = duckdb.query(query).to_df()
    
    unique_tickers = df_bulk['Ticker'].unique()
    print(f"Scanning {len(unique_tickers)} stocks for Volume Climax flags (Local Lakehouse Mode)...")
    
    alerts = []
    
    for ticker in unique_tickers:
        try:
            ticker_df = df_bulk[df_bulk['Ticker'] == ticker].copy()
            ticker_df = ticker_df.sort_values('Date').set_index('Date')
            
            if not ticker_df.empty:
                res = process_ticker(ticker, ticker_df)
                if res:
                    alerts.append(res)
                    print(f"[ALERT] Found {res['Ticker']}")
        except Exception:
            pass
                
    print(f"Found {len(alerts)} Volume Climax setups.")
    
    report = generate_markdown(alerts)
    prepend_to_file(output_file, report)
    print(f"Saved report to {output_file}")

if __name__ == "__main__":
    run_scanner()
