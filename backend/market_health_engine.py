import yfinance as yf
import pandas as pd
import json
import warnings
import datetime

warnings.filterwarnings('ignore')

# Extensive breadth proxy universe
UNIVERSE = [
    'AAPL', 'MSFT', 'NVDA', 'AVGO', 'ADBE', 'BRK-B', 'JPM', 'V', 'MA', 'BAC',
    'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'LLY', 'UNH', 'JNJ', 'MRK', 'ABBV',
    'GE', 'CAT', 'UNP', 'BA', 'HON', 'AMZN', 'TSLA', 'HD', 'MCD', 'NKE',
    'PG', 'COST', 'WMT', 'PEP', 'KO', 'NEE', 'SO', 'DUK', 'SRE', 'AEP',
    'LIN', 'SHW', 'FCX', 'ECL', 'NEM', 'PLD', 'AMT', 'EQIX', 'CCI', 'PSA',
    'META', 'GOOGL', 'GOOG', 'NFLX', 'DIS', 'TSM', 'ASML', 'AMD', 'CRM', 'ORCL',
    'VRTX', 'REGN', 'AMGN', 'GILD', 'BIIB', 'DHI', 'LEN', 'NVR', 'PHM', 'TOL',
    'FSLR', 'ENPH', 'SEDG', 'RUN', 'IONQ', 'QBTS', 'RGTI', 'IBM', 'COIN', 'ROKU',
    'PLTR', 'ASTS', 'HOOD', 'RDDT', 'ALAB', 'ARM', 'CAVA', 'SMCI', 'CELH', 'MSTR',
    'CRWD', 'PANW', 'SNOW', 'DDOG', 'NET', 'ZS', 'MDB', 'SQ', 'PYPL', 'SHOP',
    'SPY' # Benchmark
]

def calculate_health():
    print(f"Downloading 1-year data for Market Health Breadth Engine ({len(UNIVERSE)} stocks)...")
    df = yf.download(UNIVERSE, period="1y", interval="1d", group_by='ticker', progress=False)
    
    # We need to compute metrics per day
    # First, get a list of all valid trading days from SPY
    if 'SPY' not in df or df['SPY'].empty:
        print("SPY data missing, aborting.")
        return
        
    spy_df = df['SPY'].dropna()
    dates = spy_df.index
    
    # Precompute SMA50 and daily returns for all stocks to save time
    stock_data = {}
    for ticker in UNIVERSE:
        if ticker == 'SPY': continue
        if ticker not in df: continue
        t_df = df[ticker].dropna()
        if len(t_df) < 50: continue
        
        t_df['Return'] = t_df['Close'].pct_change()
        t_df['SMA50'] = t_df['Close'].rolling(50).mean()
        stock_data[ticker] = t_df

    daily_stats = []
    ad_line = 0
    net_advances_list = []
    
    # We will start looping from the 50th day to ensure SMA50 is available
    start_idx = 50
    for i in range(start_idx, len(dates)):
        date = dates[i]
        
        advancers = 0
        decliners = 0
        above_50 = 0
        total_valid = 0
        
        for ticker, t_df in stock_data.items():
            if date in t_df.index:
                row = t_df.loc[date]
                # Check A/D
                if pd.notna(row['Return']):
                    if row['Return'] > 0:
                        advancers += 1
                    elif row['Return'] < 0:
                        decliners += 1
                
                # Check % > 50 SMA
                if pd.notna(row['SMA50']):
                    total_valid += 1
                    if row['Close'] > row['SMA50']:
                        above_50 += 1
                        
        net_advances = advancers - decliners
        ad_line += net_advances
        net_advances_list.append(net_advances)
        
        pct_above_50 = (above_50 / total_valid * 100) if total_valid > 0 else 0
        
        daily_stats.append({
            "date": date.strftime("%Y-%m-%d"),
            "spy": float(spy_df.loc[date]['Close']),
            "net_advances": net_advances,
            "ad_line": ad_line,
            "pct_above_50": pct_above_50
        })

    # Now calculate McClellan Oscillator
    stats_df = pd.DataFrame(daily_stats)
    stats_df['ema19'] = stats_df['net_advances'].ewm(span=19, adjust=False).mean()
    stats_df['ema39'] = stats_df['net_advances'].ewm(span=39, adjust=False).mean()
    stats_df['mco'] = stats_df['ema19'] - stats_df['ema39']
    
    # We only want to send the last 100 days to the frontend to keep the chart clean
    final_df = stats_df.tail(100)
    
    historical_data = []
    for _, row in final_df.iterrows():
        historical_data.append({
            "date": row['date'],
            "spy": round(row['spy'], 2),
            "ad_line": int(row['ad_line']),
            "mco": round(row['mco'], 2),
            "pct_above_50": round(row['pct_above_50'], 1)
        })
        
    # Heuristics for Market Health Score
    curr_mco = final_df['mco'].iloc[-1]
    curr_pct = final_df['pct_above_50'].iloc[-1]
    
    # 5-day delta logic
    mco_5d_ago = final_df['mco'].iloc[-6] if len(final_df) > 5 else curr_mco
    pct_5d_ago = final_df['pct_above_50'].iloc[-6] if len(final_df) > 5 else curr_pct
    
    mco_delta = curr_mco - mco_5d_ago
    pct_delta = curr_pct - pct_5d_ago
    
    mco_status = "Neutral"
    if curr_mco > 50: mco_status = "Overbought"
    elif curr_mco < -50: mco_status = "Oversold"
    
    breadth_status = "Neutral"
    if curr_pct > 70: breadth_status = "Strong"
    elif curr_pct < 30: breadth_status = "Weak"
    
    # Simple divergence check (SPY making new high but A/D line dropping)
    recent_spy_high = final_df['spy'].tail(10).max()
    curr_spy = final_df['spy'].iloc[-1]
    recent_ad_high = final_df['ad_line'].tail(10).max()
    curr_ad = final_df['ad_line'].iloc[-1]
    
    divergence = "None"
    if curr_spy >= recent_spy_high * 0.99 and curr_ad < recent_ad_high * 0.95:
        divergence = "Bearish Divergence (SPY High, Breadth Low)"
    elif curr_spy <= final_df['spy'].tail(10).min() * 1.01 and curr_ad > final_df['ad_line'].tail(10).min() * 1.05:
        divergence = "Bullish Divergence (SPY Low, Breadth High)"
        
    ad_10d_ago = final_df['ad_line'].iloc[-11] if len(final_df) > 10 else curr_ad
    ad_momentum = curr_ad - ad_10d_ago
    ad_momentum_text = "Bullish (Rising)" if ad_momentum > 0 else "Bearish (Falling)"
        
    score = "Neutral"
    if mco_status == "Overbought" and mco_delta < -10 and pct_delta < -5:
        score = "Warning: Health is declining (Over-extended)"
    elif mco_status == "Oversold" and mco_delta > 10 and pct_delta > 5:
        score = "Health is improving (Oversold Bounce)"
    elif mco_status == "Oversold" and divergence == "Bullish Divergence":
        score = "Strong Buy (Oversold Divergence)"
    elif mco_status == "Overbought" and divergence == "Bearish Divergence":
        score = "Warning (Breadth Fading & Divergence)"
    elif curr_mco > 0 and mco_delta > 5 and pct_delta > 2:
        score = "Bullish & Improving"
    elif curr_mco > 0 and curr_pct > 50:
        score = "Bullish"
    elif curr_mco < 0 and mco_delta < -5 and pct_delta < -2:
        score = "Bearish & Declining"
    elif curr_mco < 0 and curr_pct < 50:
        score = "Bearish"
        
    output = {
        "current_health": {
            "score": score,
            "mco_status": mco_status,
            "breadth_status": breadth_status,
            "divergence": divergence,
            "ad_momentum": ad_momentum_text,
            "mco_value": round(curr_mco, 2),
            "pct_above_50_value": round(curr_pct, 1)
        },
        "historical_data": historical_data
    }
    
    out_path = "/Users/amitkumar/Desktop/SectorTrackerApp/public/market_health.json"
    with open(out_path, "w") as f:
        json.dump(output, f)
        
    print("Market Health Engine complete. Data saved to public/market_health.json")

if __name__ == "__main__":
    calculate_health()
