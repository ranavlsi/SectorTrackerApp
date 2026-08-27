import yfinance as yf
import pandas as pd
import numpy as np
import os
import io
import urllib.request
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

def calculate_darvas_box(df):
    if len(df) < 252:
        return None, 0, 0, ""
        
    # Macro check: must be within 15% of 52-week high
    high_52w = float(df['High'].iloc[-252:].max())
    current_close = float(df['Close'].iloc[-1])
    if current_close < high_52w * 0.85: 
        return None, 0, 0, ""
        
    # Precalculate SMAs for filtering
    sma50 = df['Close'].rolling(50).mean().values
    sma200 = df['Close'].rolling(200).mean().values
    vol_sma50 = df['Volume'].rolling(50).mean().values
    
    highs = df['High'].values
    lows = df['Low'].values
    closes = df['Close'].values
    vols = df['Volume'].values
    
    n_days = 3
    state = 0 # 0=Search Top, 1=Search Bottom, 2=Box Formed
    current_top = 0.0
    current_bottom = float('inf')
    
    last_top = 0.0
    last_bottom = 0.0
    latest_status = None
    latest_msg = ""
    
    for i in range(n_days, len(df)):
        if state == 0:
            potential_top = highs[i-n_days]
            if potential_top > highs[i-n_days-1]: 
                is_top = True
                for j in range(1, n_days + 1):
                    if highs[i-n_days+j] >= potential_top:
                        is_top = False
                        break
                if is_top:
                    current_top = potential_top
                    state = 1
                    current_bottom = lows[i] # Initial search for bottom starts here
        elif state == 1:
            potential_bottom = lows[i-n_days]
            if lows[i] < current_bottom:
                current_bottom = lows[i]
                
            is_bottom = True
            for j in range(1, n_days + 1):
                if lows[i-n_days+j] <= potential_bottom:
                    is_bottom = False
                    break
            if is_bottom and potential_bottom <= current_bottom:
                current_bottom = potential_bottom
                state = 2
                
            # Wick invalidation during bottom search
            if highs[i] > current_top:
                state = 0
                current_top = 0.0
                current_bottom = float('inf')
                
        elif state == 2:
            # Box is fully formed.
            if highs[i] > current_top:
                if closes[i] > current_top:
                    # Breakout attempt
                    v_ma = vol_sma50[i]
                    is_uptrend = sma50[i] > sma200[i] if not np.isnan(sma200[i]) else True
                    
                    if is_uptrend and vols[i] > (1.5 * v_ma):
                        if i == len(df) - 1:
                            latest_status = "STRONG_BREAKOUT"
                            latest_msg = f"Volume is {vols[i]/v_ma:.1f}x avg"
                            last_top = current_top
                            last_bottom = current_bottom
                    
                # Box is destroyed (either successful breakout or false close/wick pierce)
                state = 0
                current_top = 0.0
                current_bottom = float('inf')
            elif closes[i] < current_bottom:
                # Broken to downside
                state = 0
                current_top = 0.0
                current_bottom = float('inf')
            else:
                # Inside box
                if i == len(df) - 1:
                    dist = (current_top - closes[i]) / current_top
                    if dist <= 0.02:
                        v_ma = vol_sma50[i]
                        # Volume dry up condition (must be below 50-day average)
                        if vols[i] < v_ma:
                            latest_status = "ABOUT_TO_BREAKOUT"
                            latest_msg = f"Within {dist*100:.1f}% of Top (Dry-up)"
                            last_top = current_top
                            last_bottom = current_bottom

    if latest_status:
        return latest_status, last_top, last_bottom, latest_msg
        
    return None, 0, 0, ""

def process_ticker(ticker, df):
    try:
        if len(df) < 252:
            return None
            
        status, top, bottom, msg = calculate_darvas_box(df)
        
        if status:
            return {
                'Ticker': ticker,
                'Price': float(df['Close'].iloc[-1]),
                'Box_Top': top,
                'Box_Bottom': bottom,
                'Status': status,
                'Message': msg
            }
    except Exception:
        pass
    return None

def generate_markdown(alerts):
    date_str = datetime.now().strftime("%B %d, %Y")
    report = f"## 📦 Darvas Box Breakout Scanner - {date_str}\n"
    report += "Identifying stocks consolidating tightly in a Darvas Box near their 52-week highs, or actively breaking out on heavy volume.\n\n"
    
    about_to = [a for a in alerts if a['Status'] == 'ABOUT_TO_BREAKOUT']
    strong = [a for a in alerts if a['Status'] == 'STRONG_BREAKOUT']
    
    report += "### 🚀 Strong Volume Breakouts (Actionable Today)\n"
    if not strong:
        report += "*No strong volume breakouts out of a Darvas Box today.*\n\n"
    else:
        for a in strong:
            report += f"- **{a['Ticker']}** @ ${a['Price']:.2f} | **Box Top Cleared:** ${a['Box_Top']:.2f} | **Signal:** {a['Message']}\n"
        report += "\n"
            
    report += "### ⏱️ About to Breakout (Watchlist)\n"
    if not about_to:
        report += "*No stocks currently tight against the Box Top.*\n\n"
    else:
        for a in about_to:
            report += f"- **{a['Ticker']}** @ ${a['Price']:.2f} | **Box Top:** ${a['Box_Top']:.2f} | **Box Bottom:** ${a['Box_Bottom']:.2f} | **Signal:** {a['Message']}\n"
        report += "\n"
        
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
    base_dir = '/Users/amitkumar'
    output_file = os.path.join(base_dir, 'Desktop', 'darvas_box_alerts.md')
    
    print("Loading data from Local DuckDB Lakehouse...")
    import duckdb
    parquet_path = os.path.join('/Users/amitkumar/Desktop/SectorTrackerApp/backend', 'data', 'daily_ohlcv.parquet')
    if not os.path.exists(parquet_path):
        print("Lakehouse not found. Please run db_updater.py first.")
        return
        
    query = f"SELECT * FROM read_parquet('{parquet_path}') ORDER BY Date"
    df_bulk = duckdb.query(query).to_df()
    
    grouped = df_bulk.groupby('Ticker')
    print(f"Scanning {len(grouped)} stocks for Darvas Box setups (Local Lakehouse Mode)...")
    
    alerts = []
    
    for ticker, ticker_df in grouped:
        try:
            ticker_df = ticker_df.copy()
            ticker_df = ticker_df.sort_values('Date').set_index('Date')
            
            if not ticker_df.empty:
                res = process_ticker(ticker, ticker_df)
                if res:
                    alerts.append(res)
                    print(f"[ALERT] Found {res['Ticker']} - {res['Status']}")
        except Exception:
            pass
                
    print(f"Found {len(alerts)} Darvas Box setups.")
    
    report = generate_markdown(alerts)
    prepend_to_file(output_file, report)
    print(f"Saved report to {output_file}")

if __name__ == "__main__":
    run_scanner()
