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
        
        # nasdaqlisted
        r = io.BytesIO()
        ftp.retrbinary('RETR symboldirectory/nasdaqlisted.txt', r.write)
        r.seek(0)
        df_nasdaq = pd.read_csv(r, sep='|')
        if 'Test Issue' in df_nasdaq.columns:
            df_nasdaq = df_nasdaq[df_nasdaq['Test Issue'] == 'N']
        tickers.extend(df_nasdaq['Symbol'].dropna().tolist())
        
        # otherlisted
        r = io.BytesIO()
        ftp.retrbinary('RETR symboldirectory/otherlisted.txt', r.write)
        r.seek(0)
        df_other = pd.read_csv(r, sep='|')
        if 'Test Issue' in df_other.columns:
            df_other = df_other[df_other['Test Issue'] == 'N']
        tickers.extend(df_other['ACT Symbol'].dropna().tolist())
        
        ftp.quit()
        
        # Clean up tickers
        valid_tickers = []
        for t in tickers:
            t_str = str(t).strip()
            if t_str and t_str != 'File Creation Time:' and not pd.isna(t):
                valid_tickers.append(t_str)
                
        unique_tickers = list(set(valid_tickers))
        print(f"Successfully fetched {len(unique_tickers)} tickers.")
        return unique_tickers
    except Exception as e:
        print(f"Failed to fetch tickers from FTP: {e}")
        # Fallback if FTP fails
        return []

def calculate_avwap(df):
    """Calculates the Anchored VWAP starting from the first row of the dataframe."""
    df.columns = [col.title() for col in df.columns]
    
    if 'High' not in df.columns or 'Low' not in df.columns or 'Close' not in df.columns or 'Volume' not in df.columns:
        raise ValueError("Missing required columns for AVWAP calculation.")
        
    df['Typical_Price'] = (df['High'] + df['Low'] + df['Close']) / 3
    df['TP_Volume'] = df['Typical_Price'] * df['Volume']
    df['Cumulative_TP_Volume'] = df['TP_Volume'].cumsum()
    df['Cumulative_Volume'] = df['Volume'].cumsum()
    
    df['AVWAP'] = np.where(df['Cumulative_Volume'] > 0, 
                           df['Cumulative_TP_Volume'] / df['Cumulative_Volume'], 
                           df['Typical_Price'])
    return df

def check_fundamentals(stock):
    try:
        inc = stock.quarterly_income_stmt
        if inc is None or inc.empty:
            return False, "Missing Data"
            
        eps_row = None
        for row in ['Basic EPS', 'Diluted EPS', 'Normalized EPS']:
            if row in inc.index:
                eps_row = inc.loc[row]
                break
                
        rev_row = None
        for row in ['Total Revenue', 'Operating Revenue', 'Revenue']:
            if row in inc.index:
                rev_row = inc.loc[row]
                break
                
        if eps_row is None or rev_row is None:
            return False, "Missing EPS/Rev Data"
            
        eps_vals = eps_row.dropna().values
        rev_vals = rev_row.dropna().values
        
        if len(eps_vals) < 2 or len(rev_vals) < 2:
            return False, "Not enough quarters"
            
        eps_growth_1 = eps_vals[0] > eps_vals[1]
        rev_growth_1 = rev_vals[0] > rev_vals[1]
        
        if len(eps_vals) >= 3 and len(rev_vals) >= 3:
            eps_growth_2 = eps_vals[1] >= eps_vals[2]
            rev_growth_2 = rev_vals[1] >= rev_vals[2]
            eps_growth = eps_growth_1 and eps_growth_2
            rev_growth = rev_growth_1 and rev_growth_2
            status_msg = "Passed (2 Qtrs Growth)"
        else:
            eps_growth = eps_growth_1
            rev_growth = rev_growth_1
            status_msg = "Passed (1 Qtr Growth)"
            
        if eps_growth and rev_growth:
            return True, status_msg
        else:
            return False, "Failed Growth Check"
            
    except Exception as e:
        return False, f"Error: {str(e)}"

def process_ticker(ticker):
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period="max")
        
        if df.empty or len(df) < 2:
            return None
            
        df = calculate_avwap(df)
        last_day = df.iloc[-1]
        
        avwap = float(last_day['AVWAP'])
        close_price = float(last_day['Close'])
        high_price = float(last_day['High'])
        low_price = float(last_day['Low'])
        
        touched_avwap = low_price <= avwap <= high_price
        distance_pct = abs(close_price - avwap) / avwap * 100
        within_range = 1.0 <= distance_pct <= 5.0
        
        if touched_avwap or within_range:
            passed_fund, fund_status = check_fundamentals(stock)
            if not passed_fund:
                return None
                
            status = []
            if touched_avwap:
                status.append("Touched")
            if within_range:
                status.append(f"Within {distance_pct:.2f}%")
                
            date_val = df.index[-1]
            if hasattr(date_val, 'strftime'):
                date_val = date_val.strftime('%Y-%m-%d')
            else:
                date_val = str(date_val)[:10]
                
            return {
                'Ticker': ticker,
                'Date': date_val,
                'Close': round(close_price, 2),
                'AVWAP': round(avwap, 2),
                'Distance_Pct': round(distance_pct, 2),
                'Tech_Status': " & ".join(status),
                'Fund_Status': fund_status
            }
    except Exception:
        pass
    return None

def run_scanner():
    base_dir = '/Users/amitkumar'
    output_file = os.path.join(base_dir, 'Desktop', 'ipo_avwap_alerts.csv')
    
    tickers = get_us_tickers()
    if not tickers:
        print("No tickers to scan. Exiting.")
        return
        
    print(f"Scanning {len(tickers)} tickers for IPO AVWAP setups. This will take a while...")
    results = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(process_ticker, t): t for t in tickers}
        
        processed = 0
        for future in concurrent.futures.as_completed(futures):
            processed += 1
            result = future.result()
            
            if result:
                results.append(result)
                print(f"[ALERT] {result['Ticker']}: {result['Tech_Status']} & {result['Fund_Status']} (Close: {result['Close']:.2f}, AVWAP: {result['AVWAP']:.2f})")
                
            if processed % 500 == 0:
                print(f"Processed {processed}/{len(tickers)} tickers...")
                
    if results:
        results_df = pd.DataFrame(results)
        file_exists = os.path.isfile(output_file)
        results_df.to_csv(output_file, mode='a', header=not file_exists, index=False)
        print(f"\nScan complete. Found {len(results)} setups. Results appended to {output_file}")
    else:
        print("\nScan complete. No setups found today.")

if __name__ == "__main__":
    run_scanner()
