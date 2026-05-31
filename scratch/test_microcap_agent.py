import yfinance as yf
import pandas as pd
import random
from datetime import datetime
import time

def fetch_yahoo_screener(url):
    import requests
    from io import StringIO
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        req = requests.get(url, headers=headers, timeout=10)
        dfs = pd.read_html(StringIO(req.text))
        if dfs:
            raw_symbols = dfs[0]['Symbol'].tolist()
            return [str(s).split()[-1] for s in raw_symbols if pd.notna(s)]
    except Exception:
        pass
    return []

def get_live_momentum_tickers():
    urls = [
        'https://finance.yahoo.com/screener/predefined/day_gainers',
        'https://finance.yahoo.com/screener/predefined/most_actives'
    ]
    dynamic_tickers = set()
    for url in urls:
        dynamic_tickers.update(fetch_yahoo_screener(url))
    return list(dynamic_tickers)

def test_microcap_agent():
    print("Fetching live momentum tickers...")
    tickers = get_live_momentum_tickers()
    if not tickers:
        print("No tickers found.")
        return
        
    print(f"Analyzing {len(tickers)} momentum stocks...")
    
    # Download 1 year of data
    df = yf.download(tickers, period='1y', interval='1d', group_by='ticker', progress=False)
    
    alerts = []
    
    for ticker in tickers:
        if ticker not in df: continue
        ticker_df = df[ticker].dropna()
        if len(ticker_df) < 20: continue # Need at least 20 days of data
        
        # Calculate Gap & Crap Ratio
        # A gap up is defined as Open > Previous Close * 1.05 (5% gap)
        ticker_df['Prev_Close'] = ticker_df['Close'].shift(1)
        ticker_df['Gap_Pct'] = (ticker_df['Open'] - ticker_df['Prev_Close']) / ticker_df['Prev_Close']
        
        gap_days = ticker_df[ticker_df['Gap_Pct'] > 0.05]
        if len(gap_days) >= 3:
            # How many of these gap days closed lower than they opened? (Red candle)
            red_gaps = gap_days[gap_days['Close'] < gap_days['Open']]
            fade_ratio = len(red_gaps) / len(gap_days)
            
            if fade_ratio >= 0.70:
                alerts.append({
                    "council": "🚨 MICROCAP RISK",
                    "ticker": ticker,
                    "setup": f"Historical Fade Warning (Faded {fade_ratio*100:.0f}% of past massive gaps)",
                    "color": "#ef4444"
                })
                
        # Squeeze / Float Rotation Check
        # RVOL > 20x and price > 10% up today
        current_vol = ticker_df['Volume'].iloc[-1]
        avg_vol_20 = ticker_df['Volume'].rolling(20).mean().shift(1).iloc[-1]
        
        if avg_vol_20 > 0:
            rvol = current_vol / avg_vol_20
            today_pct = (ticker_df['Close'].iloc[-1] - ticker_df['Prev_Close'].iloc[-1]) / ticker_df['Prev_Close'].iloc[-1]
            
            if rvol >= 10 and today_pct > 0.10: # Lowered to 10x RVOL for broader net
                alerts.append({
                    "council": "🔥 SQUEEZE RADAR",
                    "ticker": ticker,
                    "setup": f"Float Rotation Detected! RVOL is {rvol:.1f}x. High Short Squeeze Probability.",
                    "color": "#f97316"
                })
                
    for alert in alerts:
        print(f"[{alert['council']}] {alert['ticker']}: {alert['setup']}")

if __name__ == "__main__":
    test_microcap_agent()
