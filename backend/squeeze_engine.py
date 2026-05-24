import yfinance as yf
import pandas as pd
import json
import warnings
import sys
import os
from screener_engine import UNIVERSE

warnings.filterwarnings('ignore')

def run_squeeze_engine():
    print(f"Running Short Squeeze Engine on {len(UNIVERSE)} stocks...")
    
    results = {
        "squeeze_started": [],
        "high_short_interest": [],
        "gamma_squeeze_setup": []
    }
    
    # Download daily data for all to check for recent spikes
    df = yf.download(UNIVERSE, period='50d', interval='1d', group_by='ticker', progress=False)
    
    for ticker in UNIVERSE:
        try:
            t = yf.Ticker(ticker)
            info = t.info
            
            # Fetch short interest data
            short_pct = info.get('shortPercentOfFloat', 0)
            short_ratio = info.get('shortRatio', 0)
            
            # Use 5% short float or 3 days to cover as minimum criteria
            if (short_pct and short_pct > 0.05) or (short_ratio and short_ratio > 3):
                if ticker not in df: continue
                ticker_df = df[ticker].dropna()
                if ticker_df.empty or len(ticker_df) < 20: continue
                
                close = ticker_df['Close']
                vol = ticker_df['Volume']
                
                # Check Options Flow
                options = t.options
                call_vol = 0
                put_vol = 0
                cp_ratio = 0
                avg_iv = 0
                
                if len(options) > 0:
                    # Fetch nearest chain
                    chain = t.option_chain(options[0])
                    call_vol = chain.calls['volume'].sum()
                    put_vol = chain.puts['volume'].sum()
                    if 'impliedVolatility' in chain.calls.columns:
                        avg_iv = chain.calls['impliedVolatility'].mean()
                    
                    if put_vol > 0:
                        cp_ratio = call_vol / put_vol
                
                # Format metrics
                short_str = f"{short_pct * 100:.1f}%" if short_pct else "N/A"
                
                # Squeeze Started Logic
                curr_c = float(close.iloc[-1])
                prev_c = float(close.iloc[-2])
                curr_v = float(vol.iloc[-1])
                avg_v = float(vol.iloc[-20:].mean())
                
                price_jump = (curr_c / prev_c) - 1
                vol_mult = curr_v / avg_v if avg_v > 0 else 0
                
                base_data = {
                    "ticker": ticker,
                    "short_float": short_str,
                    "short_ratio": short_ratio,
                    "cp_ratio": round(cp_ratio, 2)
                }
                
                if price_jump > 0.04 and vol_mult > 1.5 and cp_ratio > 1.2:
                    res = base_data.copy()
                    res["metric"] = f"+{price_jump*100:.1f}% on {vol_mult:.1f}x Vol"
                    results["squeeze_started"].append(res)
                
                elif cp_ratio > 2.0:
                    res = base_data.copy()
                    res["metric"] = f"Heavy Calls ({cp_ratio:.1f}x Puts)"
                    results["gamma_squeeze_setup"].append(res)
                    
                else:
                    res = base_data.copy()
                    # Powder Keg Score: High Days to Cover + High IV + High Put Volume
                    # If this bounces, market makers must buy back short hedges, exploding the price
                    powder_keg_score = (short_ratio * 10) + (avg_iv * 100) + (put_vol / 1000)
                    if pd.isna(powder_keg_score): powder_keg_score = 0
                    
                    res["powder_keg_score"] = powder_keg_score
                    res["metric"] = f"Short: {short_str} | IV: {avg_iv*100:.0f}% | Puts: {int(put_vol)}"
                    results["high_short_interest"].append(res)
                    
        except Exception as e:
            pass
            
    # Sort and slice
    results["high_short_interest"] = sorted(results["high_short_interest"], key=lambda x: x.get('powder_keg_score', 0), reverse=True)[:15]
    results["gamma_squeeze_setup"] = sorted(results["gamma_squeeze_setup"], key=lambda x: x.get('cp_ratio', 0) or 0, reverse=True)[:15]
    
    output_path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/squeeze_results.json'
    with open(output_path, 'w') as f:
        json.dump(results, f)
        
    print(f"Successfully wrote squeeze results to {output_path}")

if __name__ == "__main__":
    run_squeeze_engine()
