import yfinance as yf
import pandas as pd
import numpy as np
import os
import io
import concurrent.futures
from datetime import datetime
import urllib.request

def get_sp500_tickers():
    """Fetches the S&P 500 tickers from Wikipedia."""
    try:
        url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        html = urllib.request.urlopen(req).read().decode('utf-8')
        table = pd.read_html(io.StringIO(html))
        df = table[0]
        tickers = df['Symbol'].tolist()
        # Clean tickers like BRK.B to BRK-B for Yahoo Finance
        tickers = [ticker.replace('.', '-') for ticker in tickers]
        return tickers
    except Exception as e:
        print(f"Error fetching S&P 500 tickers: {e}")
        return []

def get_options_flow(ticker):
    """
    Approximates Options Flow using the Put/Call ratio for the nearest expiration.
    Returns True if Call Volume > Put Volume (bullish flow).
    """
    try:
        stock = yf.Ticker(ticker)
        dates = stock.options
        if not dates:
            return False, "No options data"
            
        # Get nearest expiration
        nearest = dates[0]
        opt = stock.option_chain(nearest)
        
        call_vol = opt.calls['volume'].sum() if 'volume' in opt.calls else 0
        put_vol = opt.puts['volume'].sum() if 'volume' in opt.puts else 0
        
        if call_vol > (put_vol * 1.5): # Call volume is 50% greater than Put volume
            return True, f"Bullish Flow (C:{call_vol} vs P:{put_vol})"
        else:
            return False, "Bearish/Neutral options flow"
    except Exception:
        return False, "Error fetching options"

def check_orb(df_1m):
    """
    Checks if there's a 15-minute ORB (Opening Range Breakout) to the upside.
    Expects df_1m to have timezone-aware datetime index in market time (EST).
    """
    try:
        # Convert index to US/Eastern timezone if it's not already
        if df_1m.index.tz is None:
            df_1m.index = df_1m.index.tz_localize('UTC').tz_convert('US/Eastern')
        else:
            df_1m.index = df_1m.index.tz_convert('US/Eastern')
            
        # Filter for today's data only
        today = df_1m.index[-1].date()
        df_today = df_1m[df_1m.index.date == today]
        
        # Opening range: 09:30 to 09:44
        opening_range = df_today.between_time('09:30', '09:44')
        if opening_range.empty or len(opening_range) < 5:
            return False, None
            
        orb_high = opening_range['High'].max()
        orb_low = opening_range['Low'].min()
        orb_volume = opening_range['Volume'].sum()
        
        # After 09:45
        after_orb = df_today.between_time('09:45', '09:59')
        if after_orb.empty:
            return False, None
            
        current_price = after_orb['Close'].iloc[-1]
        current_high = after_orb['High'].max()
        
        # Condition 1: Broke out above ORB High
        broke_out = current_high > orb_high
        
        # Condition 2: Approximation for Positive Delta (Close is near the high of the breakout candle)
        # We will check if the latest candle's close is in the top 30% of its range
        latest_candle = after_orb.iloc[-1]
        candle_range = latest_candle['High'] - latest_candle['Low']
        if candle_range > 0:
            close_position = (latest_candle['Close'] - latest_candle['Low']) / candle_range
            positive_delta = close_position >= 0.70 # Close is in top 30%
        else:
            positive_delta = True
            
        # Unusual Volume: Is the ORB volume higher than average? 
        # (This is approximated by requiring at least 500k shares in 15 mins for S&P 500)
        unusual_volume = orb_volume > 500000
            
        if broke_out and positive_delta and unusual_volume:
            return True, {
                'ORB_High': orb_high,
                'Current_Price': current_price,
                'ORB_Vol': orb_volume
            }
            
        return False, None
    except Exception as e:
        return False, None

def prepend_to_csv(filepath, new_df):
    """Prepends new_df to the CSV file at filepath."""
    if not os.path.exists(filepath):
        new_df.to_csv(filepath, index=False)
        return
        
    try:
        old_df = pd.read_csv(filepath)
        combined_df = pd.concat([new_df, old_df], ignore_index=True)
        combined_df.to_csv(filepath, index=False)
    except Exception as e:
        print(f"Error prepending to CSV: {e}")
        # Fallback to appending
        new_df.to_csv(filepath, mode='a', header=not os.path.exists(filepath), index=False)

def run_scanner():
    base_dir = '/Users/amitkumar'
    output_file = os.path.join(base_dir, 'Desktop', 'orb_scanner_alerts.csv')
    
    tickers = get_sp500_tickers()
    if not tickers:
        print("Could not get tickers.")
        return
        
    print(f"Fetching 1-minute data for {len(tickers)} S&P 500 stocks...")
    
    # Download 1m data for all tickers at once (much faster)
    df = yf.download(tickers, period='1d', interval='1m', group_by='ticker', progress=False)
    
    alerts = []
    passing_tickers = []
    orb_data = {}
    
    # Evaluate ORB technicals
    for ticker in tickers:
        try:
            if ticker in df:
                ticker_df = df[ticker].dropna()
                if not ticker_df.empty:
                    passed_orb, orb_info = check_orb(ticker_df)
                    if passed_orb:
                        passing_tickers.append(ticker)
                        orb_data[ticker] = orb_info
        except Exception:
            continue
            
    print(f"Found {len(passing_tickers)} stocks that broke the 15-min ORB with positive delta and unusual volume.")
    
    if not passing_tickers:
        print("No ORB setups found right now.")
        return
        
    # Check Options Flow for the passing tickers
    def check_flow(t):
        passed_flow, msg = get_options_flow(t)
        return t, passed_flow, msg
        
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(check_flow, t): t for t in passing_tickers}
        for future in concurrent.futures.as_completed(futures):
            t, passed_flow, msg = future.result()
            
            if passed_flow:
                info = orb_data[t]
                alerts.append({
                    'Date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'Ticker': t,
                    'ORB_High': round(info['ORB_High'], 2),
                    'Current_Price': round(info['Current_Price'], 2),
                    'ORB_Volume': info['ORB_Vol'],
                    'Options_Flow': msg
                })
                print(f"[ALERT] {t} broke ORB High {info['ORB_High']} (Price: {info['Current_Price']}). Flow: {msg}")
                
    if alerts:
        alerts_df = pd.DataFrame(alerts)
        prepend_to_csv(output_file, alerts_df)
        print(f"Saved {len(alerts)} alerts prepended to {output_file}")
    else:
        print("Setups found, but none had bullish options flow.")

if __name__ == "__main__":
    run_scanner()
