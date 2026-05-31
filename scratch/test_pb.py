import sys
import os
import yfinance as yf
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
from pending_breakout_engine import detect_pending_breakout

def run_test():
    # Let's test it on a few stocks to see if it crashes or just returns None
    for ticker in ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMD']:
        df = yf.download(ticker, period='2y', interval='1d', progress=False)
        if df.empty: continue
        
        # Flatten multiindex if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
            
        print(f"Testing {ticker}...")
        try:
            res = detect_pending_breakout(ticker, pre_df=df)
            print(f"Result for {ticker}: {res}")
        except Exception as e:
            print(f"Error for {ticker}: {e}")

if __name__ == "__main__":
    import pandas as pd
    run_test()
