import yfinance as yf
import pandas as pd
import numpy as np
import os
from datetime import datetime

# Universe of Sector and Theme ETFs
ETFS = {
    # Broad Sectors
    'XLK': 'Technology',
    'XLF': 'Financials',
    'XLE': 'Energy',
    'XLV': 'Healthcare',
    'XLI': 'Industrials',
    'XLY': 'Consumer Discretionary',
    'XLP': 'Consumer Staples',
    'XLU': 'Utilities',
    'XLB': 'Materials',
    'XLRE': 'Real Estate',
    'XLC': 'Communication Services',
    
    # Themes & Industries
    'SMH': 'Semiconductors',
    'IGV': 'Software',
    'IBB': 'Biotechnology',
    'KRE': 'Regional Banks',
    'ITB': 'Homebuilders',
    'XRT': 'Retail',
    'ICLN': 'Clean Energy',
    'ARKK': 'Innovation',
    'IYT': 'Transportation',
    'XHB': 'Homebuilders (Broad)',
    'JETS': 'Airlines',
    'URNM': 'Uranium',
    'BOTZ': 'Robotics & AI',
    'GDX': 'Gold Miners',
    'XME': 'Metals & Mining'
}

def analyze_etfs():
    tickers = list(ETFS.keys())
    
    print(f"Fetching 3 months of data for {len(tickers)} ETFs and SPY...")
    # Fetch data
    tickers_with_spy = tickers + ['SPY']
    df = yf.download(tickers_with_spy, period='3mo', interval='1d', group_by='ticker', progress=False)
    
    results = []
    try:
        spy_df = df['SPY'].dropna()
        spy_1w_return = (spy_df['Close'].iloc[-1] / spy_df['Close'].iloc[-6] - 1) * 100 if len(spy_df) >= 6 else 0
        spy_1m_return = (spy_df['Close'].iloc[-1] / spy_df['Close'].iloc[-21] - 1) * 100 if len(spy_df) >= 21 else 0
    except Exception as e:
        print("Error calculating SPY baseline:", e)
        spy_1w_return, spy_1m_return = 0, 0
    
    for ticker in tickers:
        try:
            if ticker not in df:
                continue
            t_df = df[ticker].dropna()
            if len(t_df) < 21:
                continue
                
            current_close = t_df['Close'].iloc[-1]
            close_1w_ago = t_df['Close'].iloc[-6]
            close_1m_ago = t_df['Close'].iloc[-21]
            
            # Returns
            ret_1w = (current_close / close_1w_ago - 1) * 100
            ret_1m = (current_close / close_1m_ago - 1) * 100
            
            # Relative Strength vs SPY
            rs_1w = ret_1w - spy_1w_return
            rs_1m = ret_1m - spy_1m_return
            
            # Volume Analysis
            current_vol = t_df['Volume'].iloc[-5:].mean() # Average volume last 5 days
            avg_vol_20d = t_df['Volume'].iloc[-21:-1].mean() # Average volume previous 20 days
            vol_ratio = current_vol / avg_vol_20d if avg_vol_20d > 0 else 1
            
            # Moving Averages
            sma_20 = t_df['Close'].iloc[-20:].mean()
            sma_50 = t_df['Close'].iloc[-50:].mean() if len(t_df) >= 50 else sma_20
            
            trend = "Uptrend" if current_close > sma_20 and current_close > sma_50 else "Downtrend/Choppy"
            
            results.append({
                'Ticker': ticker,
                'Name': ETFS[ticker],
                '1W_Return': ret_1w,
                '1M_Return': ret_1m,
                'RS_1W': rs_1w,
                'RS_1M': rs_1m,
                'Vol_Ratio': vol_ratio,
                'Trend': trend
            })
        except Exception as e:
            print(f"Error processing {ticker}: {e}")
            
    return pd.DataFrame(results), spy_1w_return, spy_1m_return

def generate_markdown_report(df, spy_1w, spy_1m):
    date_str = datetime.now().strftime("%B %d, %Y")
    
    # Sort for best 1-week relative strength
    df_sorted = df.sort_values(by='RS_1W', ascending=False)
    
    top_performers = df_sorted.head(5)
    bottom_performers = df_sorted.tail(3)
    
    # Identify Volume Surges (High volume ratio + Uptrend)
    volume_surges = df[(df['Vol_Ratio'] > 1.2) & (df['1W_Return'] > 0)].sort_values(by='Vol_Ratio', ascending=False)
    
    report = f"""# Sector & Theme Money Flow Report
**Date:** {date_str}

## Market Overview (S&P 500)
* **1-Week Return:** {spy_1w:.2f}%
* **1-Month Return:** {spy_1m:.2f}%

---

## 🏆 Top 5 Strongest Sectors & Themes (Focus Here)
These areas are showing the strongest momentum relative to the broader market over the last week. Look for long setups here.

"""
    for _, row in top_performers.iterrows():
        vol_indicator = "🔥 **Volume Surge!**" if row['Vol_Ratio'] > 1.2 else ""
        report += f"### {row['Name']} ({row['Ticker']}) {vol_indicator}\n"
        report += f"- **1-Week Return:** {row['1W_Return']:.2f}% (Outperforming SPY by {row['RS_1W']:.2f}%)\n"
        report += f"- **1-Month Return:** {row['1M_Return']:.2f}%\n"
        report += f"- **Trend:** {row['Trend']}\n\n"

    report += """---

## 🚨 Volume Surges (Follow the Money)
These sectors are seeing a significant surge in trading volume (over 20% higher than their 20-day average) while moving higher, indicating heavy institutional accumulation.

"""
    if not volume_surges.empty:
        for _, row in volume_surges.iterrows():
            report += f"- **{row['Name']} ({row['Ticker']}):** Volume is {(row['Vol_Ratio']-1)*100:.1f}% above average. (1W Return: {row['1W_Return']:.2f}%)\n"
    else:
        report += "- *No significant upside volume surges detected this week.*\n"

    report += """
---

## 🧊 Weakest Sectors (Avoid or Short)
Money is flowing OUT of these sectors. Avoid buying dips here.

"""
    for _, row in bottom_performers.iterrows():
        report += f"- **{row['Name']} ({row['Ticker']}):** {row['1W_Return']:.2f}% this week.\n"
        
    report += "\n\n<br><br>\n\n" # Separator for the next week's prepended report
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
    output_file = os.path.join(base_dir, 'Desktop', 'sector_rotation_report.md')
    
    df, spy_1w, spy_1m = analyze_etfs()
    
    if df.empty:
        print("No data fetched.")
        return
        
    report = generate_markdown_report(df, spy_1w, spy_1m)
    
    prepend_to_file(output_file, report)
    print(f"Report successfully generated and saved to {output_file}")

if __name__ == "__main__":
    run_scanner()
