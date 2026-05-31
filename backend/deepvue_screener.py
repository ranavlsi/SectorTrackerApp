import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
import time

def calculate_rs_rating(hist, spy_hist):
    """Calculates 3-month Absolute Strength Rating vs SPY."""
    if len(hist) < 63 or len(spy_hist) < 63:
        return 0
        
    stock_perf = (hist['Close'].iloc[-1] / hist['Close'].iloc[-63]) - 1
    spy_perf = (spy_hist['Close'].iloc[-1] / spy_hist['Close'].iloc[-63]) - 1
    
    rs_diff = (stock_perf - spy_perf) * 100
    return round(rs_diff, 2)

def check_vcp(hist):
    """Checks for Volatility Contraction Pattern (tight closes, shrinking ATR)."""
    if len(hist) < 20:
        return False
        
    # Calculate True Range
    tr1 = hist['High'] - hist['Low']
    tr2 = abs(hist['High'] - hist['Close'].shift(1))
    tr3 = abs(hist['Low'] - hist['Close'].shift(1))
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    atr_20 = tr.rolling(20).mean()
    atr_3 = tr.rolling(3).mean()
    
    # 1. Volatility Contraction
    is_vol_contracting = atr_3.iloc[-1] < (atr_20.iloc[-1] * 0.5)
    
    # 2. Price Tightness (Last 5 days range is extremely tight)
    recent_high = hist['High'].iloc[-5:].max()
    recent_low = hist['Low'].iloc[-5:].min()
    is_price_tight = (recent_high - recent_low) / hist['Close'].iloc[-1] < 0.05
    
    # 3. Volume Dry-Up (Last 3 days volume is way below 20-day average)
    avg_vol_20 = hist['Volume'].rolling(20).mean().iloc[-1]
    avg_vol_3 = hist['Volume'].iloc[-3:].mean()
    is_vol_dry = avg_vol_3 < (avg_vol_20 * 0.75)
    
    return is_vol_contracting and is_price_tight and is_vol_dry

def run_deepvue_scan():
    print("[DeepVue Engine] Starting quantitative market scan...")
    # Use top liquid momentum stocks for the scan
    tickers = ["NVDA", "AAPL", "MSFT", "AMD", "META", "AMZN", "GOOGL", "TSLA", "NFLX", "AVGO", "SMCI", "ARM", "PLTR", "HOOD", "COIN", "RDDT", "CELH", "LLY"]
    
    spy = yf.Ticker("SPY").history(period="2y")
    
    results = []
    
    for ticker in tickers:
        try:
            t = yf.Ticker(ticker)
            hist = t.history(period="2y")
            if len(hist) < 65: continue
            
            info = t.info
            
            rs_score = calculate_rs_rating(hist, spy)
            vcp_setup = check_vcp(hist)
            
            # DeepVue Technicals: 21 EMA > 50 SMA
            ema_21 = hist['Close'].ewm(span=21, adjust=False).mean().iloc[-1]
            sma_50 = hist['Close'].rolling(50).mean().iloc[-1]
            sma_200 = hist['Close'].rolling(200).mean().iloc[-1]
            current_price = hist['Close'].iloc[-1]
            
            is_uptrend = (current_price > sma_50) and (sma_50 > sma_200) and (ema_21 > sma_50)
            
            # DeepVue Fundamentals: EPS & Sales growth
            rev_growth = info.get('revenueGrowth', 0)
            eps_growth = info.get('earningsGrowth', 0)
            if rev_growth is None: rev_growth = 0
            if eps_growth is None: eps_growth = 0
            
            has_fundamentals = (rev_growth > 0.15) or (eps_growth > 0.15)
            
            results.append({
                "ticker": ticker,
                "rs_score": float(rs_score),
                "vcp_setup": bool(vcp_setup),
                "price": round(float(current_price), 2),
                "rev_growth_pct": round(float(rev_growth * 100), 1),
                "eps_growth_pct": round(float(eps_growth * 100), 1),
                "is_uptrend": bool(is_uptrend),
                "has_fundamentals": bool(has_fundamentals)
            })
            
        except Exception as e:
            print(f"[DeepVue] Error scanning {ticker}: {e}")
            
    # Sort by raw rs_score to calculate percentile ranks
    results = sorted(results, key=lambda x: x["rs_score"])
    
    final_leaders = []
    for i, res in enumerate(results):
        # Calculate percent rank (0 to 99)
        percent_rank = int((i / max(1, len(results) - 1)) * 99)
        # DeepVue RS Rating
        res["rs_rating"] = percent_rank if percent_rank > 0 else 1
        
        # Now apply the DeepVue Leader Filter (RS > 80, uptrend, fundamentals)
        print(f"[{res['ticker']}] RS Rating: {res['rs_rating']}, Uptrend: {res['is_uptrend']}, Funds: {res['has_fundamentals']}")
        if res["rs_rating"] > 70 and res["is_uptrend"] and res["has_fundamentals"]:
            final_leaders.append(res)
            
    # Sort final leaders by RS rating descending
    final_leaders = sorted(final_leaders, key=lambda x: x["rs_rating"], reverse=True)
    
    # Generate active VCP list (any stock with VCP flag and in an uptrend)
    active_vcp = [res for res in results if res.get("vcp_setup") and res.get("is_uptrend")]
    active_vcp = sorted(active_vcp, key=lambda x: x["rs_rating"], reverse=True)
    
    # Save to public directory for the React frontend
    output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'deepvue_results.json')
    with open(output_path, 'w') as f:
        json.dump({
            "leaders": final_leaders,
            "active_vcp": active_vcp
        }, f)
        
    print(f"[DeepVue Engine] Scan complete. Found {len(final_leaders)} true market leaders. Saved to deepvue_results.json")
    return final_leaders

if __name__ == "__main__":
    run_deepvue_scan()
