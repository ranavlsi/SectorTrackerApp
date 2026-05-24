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

def calculate_darvas_box(df):
    """
    Returns (status, box_top, box_bottom, message)
    status can be: "ABOUT_TO_BREAKOUT", "STRONG_BREAKOUT", or None
    """
    if len(df) < 252:
        return None, 0, 0, ""
        
    current_close = float(df['Close'].iloc[-1])
    current_vol = float(df['Volume'].iloc[-1])
    avg_vol_50 = float(df['Volume'].iloc[-50:].mean()) if len(df) >= 50 else 1
    
    # Macro check: must be within 15% of 52-week high to ensure it's in a strong uptrend
    high_52w = float(df['High'].iloc[-252:].max())
    if current_close < high_52w * 0.85: 
        return None, 0, 0, ""
        
    box_top = 0
    top_idx = -1
    
    # Find Box Top (A local high not broken for the next 3 days)
    for i in range(4, 60):
        test_high = float(df['High'].iloc[-i])
        exceeded = False
        for j in range(1, 4):
            if float(df['High'].iloc[-(i-j)]) > test_high:
                exceeded = True
                break
        if not exceeded:
            box_top = test_high
            top_idx = i
            break
            
    if box_top == 0:
        return None, 0, 0, ""
        
    # Find Box Bottom (A local low not broken for the next 3 days, occurring AFTER the top)
    box_bottom = float('inf')
    
    for i in range(3, top_idx):
        test_low = float(df['Low'].iloc[-i])
        broken = False
        for j in range(1, 4):
            if i-j > 0 and float(df['Low'].iloc[-(i-j)]) < test_low:
                broken = True
                break
        if not broken:
            box_bottom = test_low
            break
            
    if box_bottom == float('inf') or box_bottom >= box_top:
        return None, 0, 0, ""
        
    # Check "Strong Volume Breakout"
    prev_close = float(df['Close'].iloc[-2])
    if current_close > box_top and prev_close <= box_top:
        if current_vol > (avg_vol_50 * 1.5):
            return "STRONG_BREAKOUT", box_top, box_bottom, f"Volume is {current_vol/avg_vol_50:.1f}x average"
            
    # Check "About to Breakout"
    if box_bottom <= current_close <= box_top:
        distance_to_top = (box_top - current_close) / current_close
        if distance_to_top <= 0.02: # Within 2%
            return "ABOUT_TO_BREAKOUT", box_top, box_bottom, f"Within {distance_to_top*100:.1f}% of Box Top"
            
    return None, 0, 0, ""

def process_ticker(ticker):
    try:
        df = yf.download(ticker, period='1y', interval='1d', progress=False)
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
    
    print("Fetching master list of US stocks...")
    tickers = get_all_tickers()
    if not tickers:
        print("Failed to fetch tickers.")
        return
        
    print(f"Scanning {len(tickers)} stocks for Darvas Box setups...")
    
    alerts = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(process_ticker, t): t for t in tickers}
        
        count = 0
        for future in concurrent.futures.as_completed(futures):
            count += 1
            if count % 1000 == 0:
                print(f"Processed {count}/{len(tickers)}...")
            res = future.result()
            if res:
                alerts.append(res)
                print(f"[ALERT] Found {res['Ticker']} - {res['Status']}")
                
    print(f"Found {len(alerts)} Darvas Box setups.")
    
    report = generate_markdown(alerts)
    prepend_to_file(output_file, report)
    print(f"Saved report to {output_file}")

if __name__ == "__main__":
    run_scanner()
