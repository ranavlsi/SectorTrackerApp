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

def check_fundamentals(ticker):
    """Fetches quarterly income statement to check for EPS and Sales acceleration (YoY)."""
    try:
        stock = yf.Ticker(ticker)
        inc = stock.quarterly_income_stmt
        
        if inc.empty or inc.shape[1] < 5: 
            return False, "Not enough fundamental data"
            
        has_rev = 'Total Revenue' in inc.index
        has_eps = 'Diluted EPS' in inc.index or 'Basic EPS' in inc.index
        
        if not (has_rev and has_eps):
            return False, "Missing Revenue or EPS data"
            
        rev_now = inc.loc['Total Revenue'].iloc[0]
        rev_yoy = inc.loc['Total Revenue'].iloc[4]
        
        eps_key = 'Diluted EPS' if 'Diluted EPS' in inc.index else 'Basic EPS'
        eps_now = inc.loc[eps_key].iloc[0]
        eps_yoy = inc.loc[eps_key].iloc[4]
        
        if pd.isna(rev_now) or pd.isna(rev_yoy) or rev_yoy <= 0:
            return False, "Invalid Revenue data"
        if pd.isna(eps_now) or pd.isna(eps_yoy) or eps_yoy <= 0:
            return False, "Invalid EPS data"
            
        rev_growth = ((rev_now - rev_yoy) / rev_yoy) * 100
        eps_growth = ((eps_now - eps_yoy) / abs(eps_yoy)) * 100
        
        if rev_growth > 5 and eps_growth > 5: 
            return True, f"Revenue: +{rev_growth:.1f}% YoY | EPS: +{eps_growth:.1f}% YoY"
            
        return False, "Fundamentals not accelerating"
    except Exception as e:
        return False, f"Fundamental error"

def process_price_action(ticker, df):
    try:
        if len(df) < 60:
            return None
            
        # 1. Look for Earnings Reaction in the last 14 days
        # Massive gap up: Close > Open * 1.05 AND Vol > 2x 50-day average
        recent_df = df.iloc[-14:]
        
        reaction_date = None
        reaction_close = None
        reaction_high = None
        reaction_low = None
        
        for date, row in recent_df.iterrows():
            idx = df.index.get_loc(date)
            if idx < 50: continue
            
            avg_vol = df['Volume'].iloc[idx-50:idx].mean()
            price_jump = (float(row['Close']) / float(row['Open'])) - 1
            
            if price_jump > 0.05 and float(row['Volume']) > (avg_vol * 2):
                reaction_date = date
                reaction_close = float(row['Close'])
                reaction_high = float(row['High'])
                reaction_low = float(row['Low'])
                break 
                
        if not reaction_date:
            return None
            
        # 2. Check Consolidation / Flagging
        post_reaction_df = df.loc[reaction_date:]
        if len(post_reaction_df) < 3: # Need at least 3 days to form a flag
            return None
            
        current_close = float(df['Close'].iloc[-1])
        
        # Must be holding the top 50% of the earnings breakout candle
        mid_point = (reaction_high + reaction_low) / 2
        if current_close < mid_point:
            return None
            
        return {
            'Ticker': ticker,
            'Price': current_close,
            'Reaction_Date': reaction_date.strftime('%Y-%m-%d')
        }
            
    except Exception:
        pass
    return None

def generate_markdown(alerts):
    date_str = datetime.now().strftime("%B %d, %Y")
    report = f"## 🚀 Earnings Flag & Breakout Scanner - {date_str}\n"
    report += "Stocks that had massive earnings gap-ups with accelerating fundamentals, and are now flagging (consolidating) tightly, preparing for a secondary breakout.\n\n"
    
    if not alerts:
        report += "*No post-earnings flags found today.*\n\n---\n\n"
        return report
        
    for a in alerts:
        report += f"### {a['Ticker']} (Earnings Breakout on {a['Reaction_Date']})\n"
        report += f"- **Current Price:** ${a['Price']:.2f}\n"
        report += f"- **Fundamental Acceleration:** {a['Fundamentals']}\n"
        report += f"- **Technical Status:** Consolidating above 50% retracement of the earnings candle. Watch for a breakout of the flag.\n\n"
        
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
    output_file = os.path.join(base_dir, 'Desktop', 'earnings_gap_alerts.md')
    
    print("Loading data from Local DuckDB Lakehouse...")
    import duckdb
    parquet_path = os.path.join('/Users/amitkumar/Desktop/SectorTrackerApp/backend', 'data', 'daily_ohlcv.parquet')
    if not os.path.exists(parquet_path):
        print("Lakehouse not found. Please run db_updater.py first.")
        return
        
    query = f"SELECT * FROM read_parquet('{parquet_path}') ORDER BY Date"
    df_bulk = duckdb.query(query).to_df()
    
    unique_tickers = df_bulk['Ticker'].unique()
    print(f"Scanning {len(unique_tickers)} stocks for Post-Earnings Flags (Local Lakehouse Mode)...")
    
    passing_tech = []
    
    for ticker in unique_tickers:
        try:
            ticker_df = df_bulk[df_bulk['Ticker'] == ticker].copy()
            ticker_df = ticker_df.sort_values('Date').set_index('Date')
            
            if not ticker_df.empty:
                res = process_price_action(ticker, ticker_df)
                if res:
                    passing_tech.append(res)
        except Exception:
            pass
            
    print(f"Phase 1 Complete: {len(passing_tech)} stocks with post-earnings consolidation.")
    
    if not passing_tech:
        print("No setups passed technicals today.")
        return
        
    print("Phase 2: Checking fundamentals for the technical passing candidates...")
    alerts = []
    
    def check_fund_threaded(tech_res):
        passed_funds, fund_msg = check_fundamentals(tech_res['Ticker'])
        if passed_funds:
            tech_res['Fundamentals'] = fund_msg
            return tech_res
        return None
        
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(check_fund_threaded, res): res for res in passing_tech}
        
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                alerts.append(res)
                print(f"[ALERT] Found {res['Ticker']}")
                
    print(f"Found {len(alerts)} stocks with fundamental acceleration and post-earnings consolidation.")
    
    report = generate_markdown(alerts)
    prepend_to_file(output_file, report)
    print(f"Saved report to {output_file}")

if __name__ == "__main__":
    run_scanner()
