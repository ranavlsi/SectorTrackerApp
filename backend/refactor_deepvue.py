import duckdb
import pandas as pd
import json
import os
import time

def calculate_rs_rating(hist, spy_perf_val):
    if len(hist) < 63: return 0
    stock_perf = (hist['Close'].iloc[-1] / hist['Close'].iloc[-63]) - 1
    rs_diff = (stock_perf - spy_perf_val) * 100
    return round(rs_diff, 2)

def check_vcp(hist):
    if len(hist) < 20: return False
    tr1 = hist['High'] - hist['Low']
    tr2 = abs(hist['High'] - hist['Close'].shift(1))
    tr3 = abs(hist['Low'] - hist['Close'].shift(1))
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr_20 = tr.rolling(20).mean()
    atr_3 = tr.rolling(3).mean()
    is_vol_contracting = atr_3.iloc[-1] < (atr_20.iloc[-1] * 0.5)
    recent_high = hist['High'].iloc[-5:].max()
    recent_low = hist['Low'].iloc[-5:].min()
    is_price_tight = (recent_high - recent_low) / hist['Close'].iloc[-1] < 0.05
    avg_vol_20 = hist['Volume'].rolling(20).mean().iloc[-1]
    avg_vol_3 = hist['Volume'].iloc[-3:].mean()
    is_vol_dry = avg_vol_3 < (avg_vol_20 * 0.75)
    return is_vol_contracting and is_price_tight and is_vol_dry

def run_deepvue_scan():
    print("[DeepVue Engine] Loading market data from Lakehouse...")
    LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
    
    if not os.path.exists(LAKEHOUSE_PATH):
        print("Lakehouse data not found!")
        return
        
    df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()
    grouped = df.groupby('Ticker')
    
    spy_df = grouped.get_group('SPY').set_index('Date')
    spy_perf_val = (spy_df['Close'].iloc[-1] / spy_df['Close'].iloc[-63]) - 1 if len(spy_df) >= 63 else 0
    
    results = []
    
    # 1. First Pass: Technicals & RS
    print("[DeepVue Engine] Scanning technicals for all stocks...")
    for ticker, group in grouped:
        try:
            hist = group.set_index('Date')
            if len(hist) < 200: continue
            
            # Technicals: 21 EMA > 50 SMA > 200 SMA
            ema_21 = hist['Close'].ewm(span=21, adjust=False).mean().iloc[-1]
            sma_50 = hist['Close'].rolling(50).mean().iloc[-1]
            sma_200 = hist['Close'].rolling(200).mean().iloc[-1]
            current_price = hist['Close'].iloc[-1]
            
            is_uptrend = (current_price > ema_21) and (ema_21 > sma_50) and (sma_50 > sma_200)
            
            if not is_uptrend:
                continue # Skip stocks not in an uptrend to save calculation time
                
            rs_score = calculate_rs_rating(hist, spy_perf_val)
            vcp_setup = check_vcp(hist)
            
            results.append({
                "ticker": ticker,
                "rs_score": float(rs_score),
                "vcp_setup": bool(vcp_setup),
                "price": round(float(current_price), 2),
                "is_uptrend": bool(is_uptrend)
            })
        except Exception as e:
            pass
            
    # Calculate RS Ratings
    results = sorted(results, key=lambda x: x["rs_score"])
    
    top_candidates = []
    for i, res in enumerate(results):
        percent_rank = int((i / max(1, len(results) - 1)) * 99)
        res["rs_rating"] = percent_rank if percent_rank > 0 else 1
        if res["rs_rating"] > 70:
            top_candidates.append(res)
            
    print(f"[DeepVue Engine] Found {len(top_candidates)} Uptrend stocks with RS > 70. Fetching fundamentals...")
    
    # 2. Second Pass: Bulk Fundamentals via YahooQuery
    final_leaders = []
    if top_candidates:
        from yahooquery import Ticker as YQTicker
        tickers_list = [c["ticker"] for c in top_candidates]
        
        # Batch requests to avoid overwhelming YQ
        batch_size = 500
        z_fin = {}
        for i in range(0, len(tickers_list), batch_size):
            batch = tickers_list[i:i+batch_size]
            yq_t = YQTicker(batch, asynchronous=True)
            batch_fin = yq_t.financial_data
            if isinstance(batch_fin, dict):
                z_fin.update(batch_fin)
                
        for res in top_candidates:
            ticker = res["ticker"]
            f_data = z_fin.get(ticker, {})
            if isinstance(f_data, dict):
                rev_growth = f_data.get('revenueGrowth', 0)
                eps_growth = f_data.get('earningsGrowth', 0)
                
                # YahooQuery returns actual percentages (e.g., 0.15 for 15%) or sometimes strings. Let's cast safely.
                try: rev_growth = float(rev_growth) if rev_growth else 0
                except: rev_growth = 0
                try: eps_growth = float(eps_growth) if eps_growth else 0
                except: eps_growth = 0
                
                has_fundamentals = (rev_growth > 0.15) or (eps_growth > 0.15)
                
                if has_fundamentals:
                    res["rev_growth_pct"] = round(rev_growth * 100, 1)
                    res["eps_growth_pct"] = round(eps_growth * 100, 1)
                    res["has_fundamentals"] = True
                    final_leaders.append(res)

    final_leaders = sorted(final_leaders, key=lambda x: x["rs_rating"], reverse=True)
    
    active_vcp = [res for res in results if res.get("vcp_setup") and res.get("is_uptrend")]
    active_vcp = sorted(active_vcp, key=lambda x: x["rs_rating"], reverse=True)
    
    output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'deepvue_results.json')
    with open(output_path, 'w') as f:
        json.dump({"leaders": final_leaders, "active_vcp": active_vcp}, f)
        
    print(f"[DeepVue Engine] Scan complete. Found {len(final_leaders)} true market leaders. Saved to deepvue_results.json")

if __name__ == "__main__":
    run_deepvue_scan()
