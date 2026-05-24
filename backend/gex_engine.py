import yfinance as yf
import pandas as pd
import json
import math
import warnings

warnings.filterwarnings('ignore')

def calculate_gamma(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return 0
    d1 = (math.log(S / K) + (r + (sigma ** 2) / 2) * T) / (sigma * math.sqrt(T))
    gamma = math.exp(-0.5 * d1 ** 2) / (math.sqrt(2 * math.pi) * S * sigma * math.sqrt(T))
    return gamma

def run_gex_engine():
    tickers = ["SPY", "QQQ", "AAPL", "NVDA", "TSLA"]
    results = {}
    
    print("Fetching Options data for GEX Heatmaps...")
    
    for ticker in tickers:
        try:
            t = yf.Ticker(ticker)
            spot_price = t.fast_info['lastPrice']
            options = t.options
            
            if not options:
                continue
                
            # Use the closest expiration date
            chain = t.option_chain(options[0])
            calls = chain.calls
            puts = chain.puts
            
            # Basic risk-free rate assumption and Time to Expiry (T) roughly 5 days
            r = 0.05
            T = 5 / 365 
            
            gex_profile = []
            
            # Calculate Gamma Exposure by Strike
            strikes = sorted(list(set(calls['strike']).union(set(puts['strike']))))
            
            for strike in strikes:
                # Filter bounds: only look at strikes near the money (±10%)
                if strike < spot_price * 0.9 or strike > spot_price * 1.1:
                    continue
                    
                call_row = calls[calls['strike'] == strike]
                put_row = puts[puts['strike'] == strike]
                
                c_gamma = 0
                c_oi = 0
                if not call_row.empty:
                    iv = call_row.iloc[0]['impliedVolatility']
                    c_oi = call_row.iloc[0]['openInterest']
                    if pd.notna(iv) and pd.notna(c_oi):
                        c_gamma = calculate_gamma(spot_price, strike, T, r, iv)
                        
                p_gamma = 0
                p_oi = 0
                if not put_row.empty:
                    iv = put_row.iloc[0]['impliedVolatility']
                    p_oi = put_row.iloc[0]['openInterest']
                    if pd.notna(iv) and pd.notna(c_oi):
                        p_gamma = calculate_gamma(spot_price, strike, T, r, iv)
                        
                # GEX = (Call Gamma * Call OI) - (Put Gamma * Put OI)
                # Multiplied by 100 for standard option sizing and Spot Price to get dollar gamma
                net_gex = ((c_gamma * c_oi) - (p_gamma * p_oi)) * 100 * spot_price
                
                gex_profile.append({
                    "strike": float(strike),
                    "net_gex": float(net_gex),
                    "call_oi": int(c_oi) if pd.notna(c_oi) else 0,
                    "put_oi": int(p_oi) if pd.notna(p_oi) else 0
                })
                
            results[ticker] = {
                "spot_price": spot_price,
                "gex_profile": gex_profile
            }
            
        except Exception as e:
            print(f"Error processing {ticker}: {e}")
            
    output_path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/gex_results.json'
    with open(output_path, 'w') as f:
        json.dump(results, f)
        
    print(f"Successfully wrote GEX results to {output_path}")

if __name__ == "__main__":
    run_gex_engine()
