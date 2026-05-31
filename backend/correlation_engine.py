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
    print("Fetching data for Actionable Macro Scenarios Dashboard...")
    
    # Expand universe to get more comprehensive baskets
    tickers_to_fetch = UNIVERSE[:60] + list(MACRO_DRIVERS.keys())
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
    
    # Format for actionable frontend UI
    results = {
        "scenarios": []
    }
    
    for driver_sym, driver_name in MACRO_DRIVERS.items():
        if driver_sym not in corr_matrix.columns:
            continue
            
        driver_corrs = corr_matrix[driver_sym].drop(index=list(MACRO_DRIVERS.keys()), errors='ignore')
        
        # Sort by most positive and most negative
        most_positive = driver_corrs[driver_corrs > 0.3].sort_values(ascending=False).head(8)
        most_negative = driver_corrs[driver_corrs < -0.3].sort_values(ascending=True).head(8)
        
        # Create actionable basket data
        scenario = {
            "driver": driver_name,
            "if_up": [
                {"ticker": t, "corr": float(c), "action": "buy"} for t, c in most_positive.items()
            ],
            "if_down": [
                {"ticker": t, "corr": float(c), "action": "buy"} for t, c in most_negative.items()
            ]
        }
        results["scenarios"].append(scenario)
            
    output_path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/correlation_results.json'
    with open(output_path, 'w') as f:
        json.dump(results, f)
        
    print(f"Successfully wrote actionable macro scenarios to {output_path}")

if __name__ == "__main__":
    run_correlation_engine()
