import yfinance as yf
import pandas as pd
import json
import warnings
from screener_engine import UNIVERSE

warnings.filterwarnings('ignore')

MACRO_DRIVERS = {
    "^TNX": "10-Yr Yield",
    "DX-Y.NYB": "US Dollar (DXY)",
    "CL=F": "Crude Oil",
    "BTC-USD": "Bitcoin"
}

def run_correlation_engine():
    print("Fetching data for Cross-Asset Correlation Matrix...")
    
    tickers_to_fetch = UNIVERSE[:20] + list(MACRO_DRIVERS.keys())  # Limit to top 20 stocks for clean UI
    df = yf.download(tickers_to_fetch, period="90d", interval="1d", group_by="ticker", progress=False)
    
    # Extract closing prices
    close_prices = pd.DataFrame()
    for t in tickers_to_fetch:
        if t in df and not df[t]['Close'].empty:
            close_prices[t] = df[t]['Close']
            
    # Calculate daily returns
    returns = close_prices.pct_change().dropna()
    
    # Calculate correlation matrix
    corr_matrix = returns.corr().round(2)
    
    # Format for frontend
    results = {
        "macro_drivers": list(MACRO_DRIVERS.values()),
        "stocks": []
    }
    
    for stock in UNIVERSE[:20]:
        if stock in corr_matrix.index:
            stock_data = {"ticker": stock, "correlations": {}}
            for driver_sym, driver_name in MACRO_DRIVERS.items():
                if driver_sym in corr_matrix.columns:
                    stock_data["correlations"][driver_name] = corr_matrix.loc[stock, driver_sym]
            results["stocks"].append(stock_data)
            
    output_path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/correlation_results.json'
    with open(output_path, 'w') as f:
        json.dump(results, f)
        
    print(f"Successfully wrote correlation results to {output_path}")

if __name__ == "__main__":
    run_correlation_engine()
