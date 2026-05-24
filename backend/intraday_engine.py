import yfinance as yf
import pandas as pd
import json
import warnings
import time

warnings.filterwarnings('ignore')

# Broad Universe (Mega Caps, High Beta, S&P 100 proxy)
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
    'CRWD', 'PANW', 'SNOW', 'DDOG', 'NET', 'ZS', 'MDB', 'SQ', 'PYPL', 'SHOP'
]

def run_intraday_scanner():
    print(f"Starting Market-Wide Intraday ORB Scan for {len(UNIVERSE)} stocks...")
    
    # 1. Download 15m data in one massive batch (Fast)
    df = yf.download(UNIVERSE, period="5d", interval="15m", group_by='ticker', progress=False)
    
    orb_breakouts = []
    
    for ticker in UNIVERSE:
        if ticker not in df: continue
        ticker_df = df[ticker].dropna()
        if ticker_df.empty: continue
        
        # Get data for the most recent day in the dataset
        last_day = ticker_df.index[-1].date()
        day_data = ticker_df[ticker_df.index.date == last_day]
        if day_data.empty: continue
        
        # 1. 15-Min ORB Pivot
        orb_candle = day_data.iloc[0]
        orb_high = orb_candle['High']
        
        curr_candle = day_data.iloc[-1]
        curr_c = curr_candle['Close']
        curr_vol = curr_candle['Volume']
        avg_vol = day_data['Volume'].mean()
        
        # 2. Breakout Check: Current price > ORB High and Volume is unusual
        if curr_c > orb_high and curr_vol > avg_vol * 1.5:
            orb_breakouts.append({
                "ticker": ticker,
                "orb_pivot": float(orb_high),
                "current_price": float(curr_c),
                "vol_multiplier": float(curr_vol / avg_vol)
            })
            
    print(f"Phase 1 Complete: Found {len(orb_breakouts)} stocks breaking 15m ORB.")
    
    results = []
    
    # 3. Filter via Options Flow ONLY for the broken-out stocks (Massive optimization)
    print("Phase 2: Scanning Options Flow for institutional confirmation...")
    for alert in orb_breakouts:
        ticker = alert['ticker']
        try:
            t = yf.Ticker(ticker)
            expirations = t.options
            if expirations:
                chain = t.option_chain(expirations[0])
                call_vol = chain.calls['volume'].sum()
                put_vol = chain.puts['volume'].sum()
                
                # If Call Vol > Put Vol significantly, add to final results
                if call_vol > put_vol * 1.2:
                    alert["call_put_ratio"] = float(call_vol / max(1, put_vol))
                    results.append(alert)
                    print(f"--> Confirmed Flow on {ticker}: Call/Put Ratio = {alert['call_put_ratio']:.2f}x")
        except Exception as e:
            pass
            
    # Dump to JSON
    output_path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/intraday_results.json'
    with open(output_path, 'w') as f:
        json.dump({"results": results}, f)
        
    print(f"Scan complete. Wrote {len(results)} confirmed setups to JSON.")

if __name__ == "__main__":
    run_intraday_scanner()
