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
        # Filter out warrants and other weird symbols if possible, but YF will just skip them
        return tickers
    except Exception as e:
        print(f"Error fetching tickers: {e}")
        return []

def identify_candlestick(df):
    """Checks the last 3 days for our 8 bullish patterns."""
    if len(df) < 5:
        return False, ""
    
    c1 = df.iloc[-3] 
    c2 = df.iloc[-2] 
    c3 = df.iloc[-1] 
    
    def is_red(c): return c['Close'] < c['Open']
    def is_green(c): return c['Close'] > c['Open']
    def body(c): return abs(c['Close'] - c['Open'])
    def mid(c): return (c['Close'] + c['Open']) / 2
    def lower_wick(c): return min(c['Open'], c['Close']) - c['Low']
    def upper_wick(c): return c['High'] - max(c['Open'], c['Close'])
    
    patterns = []
    
    if is_red(c2) and is_green(c3) and c3['Close'] > c2['Open'] and c3['Open'] < c2['Close']:
        patterns.append("Bullish Engulfing")
        
    if is_red(c2) and is_green(c3) and c3['Open'] < c2['Low'] and c3['Close'] > mid(c2):
        patterns.append("Piercing Line")
        
    if is_red(c1) and is_green(c3) and body(c2) < (body(c1)*0.3) and c3['Close'] > mid(c1):
        patterns.append("Morning Star")
        
    if is_red(c2) and is_green(c3) and c3['Open'] > c2['Close'] and c3['Close'] < c2['Open']:
        if body(c3) < body(c2)*0.5:
            patterns.append("Bullish Harami (Inside Bar)")
            
    if is_red(c2) and is_green(c3) and c2['Low'] > 0 and abs(c2['Low'] - c3['Low']) / c2['Low'] < 0.002:
        patterns.append("Tweezer Bottom")
        
    if is_green(c1) and is_green(c2) and is_green(c3):
        if c2['Close'] > c1['Close'] and c3['Close'] > c2['Close']:
            if body(c1) > 0 and body(c2) > 0 and body(c3) > 0:
                if upper_wick(c1) < body(c1)*0.2 and upper_wick(c2) < body(c2)*0.2 and upper_wick(c3) < body(c3)*0.2:
                    patterns.append("Three White Soldiers")
                
    c0 = df.iloc[-4]
    if c1['High'] < c0['High'] and c1['Low'] > c0['Low']:
        if c2['Low'] < c1['Low'] and c2['Close'] < c1['Low']:
            if c3['Close'] > c1['High']:
                patterns.append("Bullish Hikkake")
                
    if is_red(c2) and is_red(c3) and c3['Open'] < c2['Open'] and c3['Close'] > c2['Close']:
        patterns.append("Homing Pigeon")
        
    if patterns:
        return True, ", ".join(patterns)
    return False, ""

def process_ticker(ticker):
    try:
        df = yf.download(ticker, period='1y', interval='1d', progress=False)
        if len(df) < 200:
            return None
            
        current_close = float(df['Close'].iloc[-1])
        
        df['SMA_50'] = df['Close'].rolling(window=50).mean()
        df['SMA_200'] = df['Close'].rolling(window=200).mean()
        df['SMA_20'] = df['Close'].rolling(window=20).mean()
        
        sma_50 = float(df['SMA_50'].iloc[-1])
        sma_200 = float(df['SMA_200'].iloc[-1])
        sma_20 = float(df['SMA_20'].iloc[-1])
        
        # 1. Higher Timeframe Uptrend
        if not (sma_50 > sma_200 and current_close > sma_200):
            return None
            
        # 2. Short Term Pullback (Below 20 SMA or down 5% from recent high)
        high_20d = float(df['High'].iloc[-20:].max())
        if not (current_close < sma_20 or current_close < high_20d * 0.95):
            return None
            
        # 3. Candlestick Pattern
        found, pattern_str = identify_candlestick(df)
        
        if found:
            return {
                'Ticker': ticker,
                'Price': current_close,
                'Pattern': pattern_str,
                'Volume': int(df['Volume'].iloc[-1]),
                'Trend': f"Price > 200 SMA ({sma_200:.2f})"
            }
            
    except Exception as e:
        pass
    return None

def generate_markdown(alerts):
    date_str = datetime.now().strftime("%B %d, %Y")
    report = f"## 🕯️ Candlestick Pullback Reversals - {date_str}\n"
    report += "Stocks in a firm higher-timeframe uptrend that have recently pulled back and are printing a confirmed bullish reversal pattern.\n\n"
    
    if not alerts:
        report += "*No high-probability candlestick reversals found today.*\n\n---\n\n"
        return report
        
    for a in alerts:
        report += f"### {a['Ticker']} - {a['Pattern']}\n"
        report += f"- **Current Price:** ${a['Price']:.2f}\n"
        report += f"- **Trend Structure:** {a['Trend']}\n"
        report += f"- **Volume:** {a['Volume']:,}\n\n"
        
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
    output_file = os.path.join(base_dir, 'Desktop', 'candlestick_pullback_alerts.md')
    
    print("Fetching master list of US stocks...")
    tickers = get_all_tickers()
    if not tickers:
        print("Failed to fetch tickers.")
        return
        
    # Limit to 5000 for realistic execution time without API bans, 
    # but the user wanted full market if possible. 
    # We will use ThreadPoolExecutor with 15 workers.
    print(f"Scanning {len(tickers)} stocks for candlestick pullbacks...")
    
    alerts = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
        # Using a subset for faster testing right now, but full list runs on cron
        # Actually I will just run the full list!
        futures = {executor.submit(process_ticker, t): t for t in tickers}
        
        count = 0
        for future in concurrent.futures.as_completed(futures):
            count += 1
            if count % 1000 == 0:
                print(f"Processed {count}/{len(tickers)}...")
            res = future.result()
            if res:
                alerts.append(res)
                
    print(f"Found {len(alerts)} stocks with bullish pullback patterns.")
    
    report = generate_markdown(alerts)
    prepend_to_file(output_file, report)
    print(f"Saved report to {output_file}")

if __name__ == "__main__":
    run_scanner()
