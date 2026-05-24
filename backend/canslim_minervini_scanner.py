import yfinance as yf
import pandas as pd
import numpy as np
import os
import ftplib
import io
import concurrent.futures
from datetime import datetime

def get_us_tickers():
    print("Fetching all US listed tickers from NASDAQ FTP...")
    tickers = []
    try:
        ftp = ftplib.FTP('ftp.nasdaqtrader.com')
        ftp.login()
        
        r = io.BytesIO()
        ftp.retrbinary('RETR symboldirectory/nasdaqlisted.txt', r.write)
        r.seek(0)
        df_nasdaq = pd.read_csv(r, sep='|')
        if 'Test Issue' in df_nasdaq.columns:
            df_nasdaq = df_nasdaq[df_nasdaq['Test Issue'] == 'N']
        tickers.extend(df_nasdaq['Symbol'].dropna().tolist())
        
        r = io.BytesIO()
        ftp.retrbinary('RETR symboldirectory/otherlisted.txt', r.write)
        r.seek(0)
        df_other = pd.read_csv(r, sep='|')
        if 'Test Issue' in df_other.columns:
            df_other = df_other[df_other['Test Issue'] == 'N']
        tickers.extend(df_other['ACT Symbol'].dropna().tolist())
        
        ftp.quit()
        
        valid_tickers = [str(t).strip() for t in tickers if str(t).strip() and str(t).strip() != 'File Creation Time:' and not pd.isna(t)]
        unique_tickers = list(set(valid_tickers))
        print(f"Successfully fetched {len(unique_tickers)} tickers.")
        return unique_tickers
    except Exception as e:
        print(f"Failed to fetch tickers: {e}")
        return []

def minervini_technical_screen(df):
    """
    Applies Mark Minervini Trend Template.
    Returns (True, status_message) or (False, reason)
    """
    if len(df) < 200:
        return False, "Not enough data (need 200 days)"
        
    df = df.copy()
    # Calculate SMAs
    df['SMA_50'] = df['Close'].rolling(window=50).mean()
    df['SMA_150'] = df['Close'].rolling(window=150).mean()
    df['SMA_200'] = df['Close'].rolling(window=200).mean()
    
    # 52-week High/Low (approx 252 trading days)
    df['52_Week_Low'] = df['Close'].rolling(window=252).min()
    df['52_Week_High'] = df['Close'].rolling(window=252).max()
    
    current = df.iloc[-1]
    
    # Condition 1: Current price is above both the 150-day and 200-day SMAs
    cond1 = current['Close'] > current['SMA_150'] and current['Close'] > current['SMA_200']
    
    # Condition 2: 150-day SMA is above 200-day SMA
    cond2 = current['SMA_150'] > current['SMA_200']
    
    # Condition 3: 200-day SMA is trending up for at least 1 month (approx 20 trading days)
    try:
        sma_200_20days_ago = df.iloc[-21]['SMA_200']
        cond3 = current['SMA_200'] > sma_200_20days_ago
    except:
        cond3 = False
        
    # Condition 4: 50-day SMA is above 150-day and 200-day SMAs
    cond4 = current['SMA_50'] > current['SMA_150'] and current['SMA_50'] > current['SMA_200']
    
    # Condition 5: Current price is above 50-day SMA
    cond5 = current['Close'] > current['SMA_50']
    
    # Condition 6: Current price is at least 30% above 52-week low
    cond6 = current['Close'] >= (1.30 * current['52_Week_Low'])
    
    # Condition 7: Current price is within 25% of 52-week high
    cond7 = current['Close'] >= (0.75 * current['52_Week_High'])
    
    if cond1 and cond2 and cond3 and cond4 and cond5 and cond6 and cond7:
        return True, "Passed Minervini"
    else:
        return False, "Failed Minervini"

def canslim_fundamental_screen(stock):
    """
    Applies relaxed CAN SLIM fundamental rules.
    C: Current Qtr EPS Growth > 20% (YoY)
    A: Annual EPS Growth > 20%
    """
    try:
        # Quarterly Check (YoY)
        q_inc = stock.quarterly_income_stmt
        if q_inc is None or q_inc.empty:
            return False, "Missing Qtr Data"
            
        eps_row = None
        for row in ['Basic EPS', 'Diluted EPS', 'Normalized EPS']:
            if row in q_inc.index:
                eps_row = q_inc.loc[row]
                break
                
        if eps_row is None:
            return False, "Missing Qtr EPS Data"
            
        eps_vals = eps_row.dropna().values
        # To do YoY, we need at least 5 quarters (Q0 vs Q4)
        if len(eps_vals) >= 5:
            q_eps_growth = eps_vals[0] > (eps_vals[4] * 1.20) # 20% YoY growth
        elif len(eps_vals) >= 2:
            # Fallback: Just sequential growth > 0 if not enough data for YoY
            q_eps_growth = eps_vals[0] > eps_vals[1]
        else:
            return False, "Not enough Qtr EPS data"
            
        # Annual Check
        a_inc = stock.income_stmt
        if a_inc is None or a_inc.empty:
            return False, "Missing Ann Data"
            
        a_eps_row = None
        for row in ['Basic EPS', 'Diluted EPS', 'Normalized EPS']:
            if row in a_inc.index:
                a_eps_row = a_inc.loc[row]
                break
                
        if a_eps_row is None:
            return False, "Missing Ann EPS Data"
            
        a_eps_vals = a_eps_row.dropna().values
        if len(a_eps_vals) >= 2:
            a_eps_growth = a_eps_vals[0] > (a_eps_vals[1] * 1.20) # 20% annual growth
        else:
            return False, "Not enough Ann EPS data"
            
        if q_eps_growth and a_eps_growth:
            return True, "Passed CAN SLIM"
        else:
            return False, "Failed CAN SLIM"
            
    except Exception as e:
        return False, f"Error: {str(e)}"

def process_ticker(ticker):
    try:
        stock = yf.Ticker(ticker)
        # Pull 2 years to safely calculate 252-day high/low and 200 SMA
        df = stock.history(period="2y")
        if df.empty or len(df) < 200:
            return None
            
        # 1. Technical Screen
        tech_pass, tech_msg = minervini_technical_screen(df)
        if not tech_pass:
            return None
            
        # 2. Fundamental Screen
        fund_pass, fund_msg = canslim_fundamental_screen(stock)
        if not fund_pass:
            return None
            
        close_price = df.iloc[-1]['Close']
        date_val = df.index[-1]
        if hasattr(date_val, 'strftime'):
            date_val = date_val.strftime('%Y-%m-%d')
        else:
            date_val = str(date_val)[:10]
            
        return {
            'Date': date_val,
            'Ticker': ticker,
            'Close': round(close_price, 2),
            'Status': "Passed Minervini & CAN SLIM"
        }
    except Exception:
        pass
    return None

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
    output_file = os.path.join(base_dir, 'canslim_minervini_alerts.csv')
    
    tickers = get_us_tickers()
    if not tickers:
        print("No tickers to scan. Exiting.")
        return
        
    print(f"Scanning {len(tickers)} tickers for CAN SLIM & Minervini setups. This will take a while...")
    results = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(process_ticker, t): t for t in tickers}
        
        processed = 0
        for future in concurrent.futures.as_completed(futures):
            processed += 1
            result = future.result()
            
            if result:
                results.append(result)
                print(f"[ALERT] {result['Ticker']}: {result['Status']} (Close: {result['Close']:.2f})")
                
            if processed % 500 == 0:
                print(f"Processed {processed}/{len(tickers)} tickers...")
                
    if results:
        results_df = pd.DataFrame(results)
        prepend_to_csv(output_file, results_df)
        print(f"\nScan complete. Found {len(results)} setups. Results prepended to {output_file}")
    else:
        print("\nScan complete. No setups found today.")

if __name__ == "__main__":
    run_scanner()
