import pandas as pd
import numpy as np
import json
import duckdb
import datetime
from yahooquery import Ticker as YQTicker
import sys
import time
from dotenv import load_dotenv
load_dotenv()

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
OUTPUT_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/public/rs_scanner_results.json'

def detect_rs_cup_and_handle(rs_line):
    # rs_line is a pandas Series of weekly RS values (len ~ 52)
    if len(rs_line) < 15:
        return {"status": "none", "score": 0, "details": {}}
        
    peak_idx = rs_line.argmax()
    peak_val = rs_line.iloc[peak_idx]
    
    # Need time after peak to form cup and handle
    if peak_idx > len(rs_line) - 5:
        return {"status": "none", "score": 0, "details": {}}
        
    cup_data = rs_line.iloc[peak_idx:]
    trough_val = cup_data.min()
    trough_idx = cup_data.argmin() + peak_idx
    
    if trough_idx >= len(rs_line) - 2:
        return {"status": "none", "score": 0, "details": {}}
        
    cup_depth = float((peak_val - trough_val) / peak_val)
    if not (0.10 <= cup_depth <= 0.40):
        return {"status": "none", "score": 0, "details": {}}
        
    cup_duration = int(trough_idx - peak_idx)
    if cup_duration < 3: # min duration constraint
        return {"status": "none", "score": 0, "details": {}}
        
    right_side_data = rs_line.iloc[trough_idx+1:]
    if right_side_data.empty:
        return {"status": "none", "score": 0, "details": {}}
        
    right_rim_val = right_side_data.max()
    right_rim_idx = right_side_data.argmax() + trough_idx + 1
    
    # Right rim must recover to >= 85% of left rim (peak)
    if right_rim_val < peak_val * 0.85:
        return {"status": "none", "score": 0, "details": {}}
        
    handle_data = rs_line.iloc[right_rim_idx:]
    if handle_data.empty:
        # Cup is forming, no handle yet
        return {
            "status": "cup", 
            "score": 40 + (10 if 0.12 <= cup_depth <= 0.25 else 0), 
            "details": {"depth": cup_depth, "duration": cup_duration}
        }
        
    handle_low = handle_data.min()
    
    # Handle must be in upper half of the cup
    cup_midpoint = trough_val + (peak_val - trough_val) * 0.5
    if handle_low < cup_midpoint:
        return {"status": "none", "score": 0, "details": {}}
        
    handle_depth = float((right_rim_val - handle_low) / right_rim_val)
    handle_duration = int(len(handle_data))
    
    if not (0.02 <= handle_depth <= 0.12) or handle_duration > 7:
        return {
            "status": "cup", 
            "score": 40 + (10 if 0.12 <= cup_depth <= 0.25 else 0), 
            "details": {"depth": cup_depth, "duration": cup_duration}
        }
        
    # Full Cup & Handle
    score = 70
    if 0.12 <= cup_depth <= 0.25: score += 10
    if right_rim_val >= peak_val * 0.95: score += 10
    if handle_depth <= 0.08: score += 5
    if 7 <= cup_duration <= 26: score += 5
    
    return {
        "status": "c_and_h",
        "score": score,
        "details": {
            "cup_depth": cup_depth,
            "handle_depth": handle_depth,
            "cup_duration": cup_duration,
            "handle_duration": handle_duration
        }
    }

def calculate_adr(highs, lows):
    if len(highs) == 0: return 0
    adrs = (highs - lows) / lows
    return adrs.mean() * 100

def run_rs_scanner():
    print(f"Loading SPY baseline from {LAKEHOUSE_PATH}...")
    
    # Load SPY and resample to Weekly (W-FRI)
    spy_df = duckdb.query(f"SELECT Date as date, Close as close FROM '{LAKEHOUSE_PATH}' WHERE Ticker='SPY' ORDER BY Date").df()
    if spy_df.empty:
        print("ERROR: SPY data not found in Lakehouse.")
        return
        
    spy_df['date'] = pd.to_datetime(spy_df['date'])
    spy_df.set_index('date', inplace=True)
    spy_weekly = spy_df.resample('W-FRI').last()
    
    print("Loading all stocks from Lakehouse (DuckDB fast weekly resample)...")
    weekly_query = f"""
    SELECT 
        Ticker as ticker,
        date_trunc('week', Date) + INTERVAL 4 DAYS as date,
        last(Close) as close,
        max(High) as high,
        min(Low) as low,
        sum(Volume) as volume
    FROM '{LAKEHOUSE_PATH}'
    GROUP BY Ticker, date_trunc('week', Date)
    ORDER BY date
    """
    all_stocks = duckdb.query(weekly_query).df()
    all_stocks['date'] = pd.to_datetime(all_stocks['date'])
    
    print("Processing Weekly RS Lines...")
    
    rs_results = []
    grouped = all_stocks.groupby('ticker')
    
    total = len(grouped)
    idx = 0
    for ticker, df in grouped:
        idx += 1
        if idx % 1000 == 0: print(f"Processed {idx}/{total}...")
        
        if len(df) < 52: continue
        
        df = df.copy()
        df.set_index('date', inplace=True)
        weekly = df
        
        if len(weekly) < 52: continue
        
        # Limit to last 52 weeks
        weekly_52 = weekly.iloc[-52:]
        spy_aligned = spy_weekly.reindex(weekly_52.index).ffill()
        
        # Calculate RS Ratio
        rs_ratio = weekly_52['close'] / spy_aligned['close']
        rs_ratio_normalized = rs_ratio / rs_ratio.iloc[0]
        
        current_rs = rs_ratio_normalized.iloc[-1]
        high_52_rs = rs_ratio_normalized.max()
        rs_vs_high = (current_rs / high_52_rs) * 100
        
        # Price Proximity to 52w High
        current_price = weekly_52['close'].iloc[-1]
        high_52_price = weekly_52['high'].max()
        price_vs_high = (current_price / high_52_price) * 100
        
        high_52_idx = weekly_52['high'].argmax()
        weeks_since_high = len(weekly_52) - 1 - high_52_idx
        
        # FILTER: Skip stocks that have already broken out (>99% of high) or are too far away (<80% of high)
        if price_vs_high >= 99.0 or price_vs_high < 80.0:
            continue
            
        # FILTER 2: Ensure it hasn't already broken out in the last 3 weeks
        if weeks_since_high < 3:
            continue
        
        # ADR% (over 20 weeks)
        recent_20 = weekly_52.iloc[-20:]
        adr_pct = calculate_adr(recent_20['high'], recent_20['low'])
        
        # Determine Badge Status
        if rs_vs_high >= 99.5:
            rs_badge = "New High"
        elif rs_vs_high >= 98.0:
            rs_badge = "Near High"
        elif rs_vs_high >= 95.0:
            rs_badge = "Watch"
        else:
            rs_badge = "None"
            
        # Cup and Handle Detection on RS Line
        ch_analysis = detect_rs_cup_and_handle(rs_ratio_normalized)
        
        rs_results.append({
            "ticker": ticker,
            "rs_raw_return": (rs_ratio_normalized.iloc[-1] - 1.0) * 100, # Used for RS Rating percentile
            "rs_vs_high": rs_vs_high,
            "rs_badge": rs_badge,
            "pattern_status": ch_analysis['status'],
            "pattern_score": ch_analysis['score'],
            "pattern_details": ch_analysis['details'],
            "adr_pct": adr_pct,
            "sparkline": rs_ratio_normalized.round(3).tolist(),
            "price": float(weekly_52['close'].iloc[-1]),
            "volume_20w_avg": float(weekly_52['volume'].iloc[-20:].mean()),
            "current_volume": float(weekly_52['volume'].iloc[-1])
        })
        
    print(f"Scanned {len(rs_results)} stocks with 52-week histories.")
    
    # Calculate RS Rating Percentile (1-99)
    rs_raw_returns = [r['rs_raw_return'] for r in rs_results]
    
    from scipy import stats
    percentiles = [stats.percentileofscore(rs_raw_returns, r) for r in rs_raw_returns]
    
    candidates = []
    zacks_query_list = []
    
    for i, r in enumerate(rs_results):
        r['rs_rating'] = int(percentiles[i])
        
        # Only keep interesting setups to save bandwidth on the Bulk Query
        if r['rs_rating'] >= 50 and (r['rs_badge'] != "None" or r['pattern_status'] != "none"):
            candidates.append(r)
            zacks_query_list.append(r['ticker'])
            
    print(f"Found {len(candidates)} high-potential RS candidates. Running Bulk Fundamentals/Earnings Query...")
    
    # Bulk Fetch Market Cap and Earnings Dates
    if len(zacks_query_list) > 0:
        chunk_size = 500
        for i in range(0, len(zacks_query_list), chunk_size):
            chunk = zacks_query_list[i:i+chunk_size]
            yq = YQTicker(chunk, asynchronous=True)
            try:
                details = yq.summary_detail
                cal = yq.calendar_events
                quote_types = yq.quote_type
                
                for t in chunk:
                    mcap = 0
                    earnings_days = 999
                    is_etf = False
                    
                    if isinstance(quote_types, dict) and t in quote_types and isinstance(quote_types[t], dict):
                        if quote_types[t].get('quoteType', '') == 'ETF':
                            is_etf = True
                            
                    if isinstance(details, dict) and t in details and isinstance(details[t], dict):
                        mcap = details[t].get('marketCap', 0)
                        
                    if isinstance(cal, dict) and t in cal and isinstance(cal[t], dict):
                        earnings = cal[t].get('earnings', {})
                        if isinstance(earnings, dict) and 'earningsDate' in earnings:
                            edates = earnings['earningsDate']
                            if len(edates) > 0:
                                edate_str = edates[0]
                                try:
                                    edate_obj = datetime.datetime.strptime(edate_str[:10], '%Y-%m-%d')
                                    delta = (edate_obj - datetime.datetime.now()).days
                                    if delta >= 0:
                                        earnings_days = delta
                                except:
                                    pass
                                    
                    for c in candidates:
                        if c['ticker'] == t:
                            c['market_cap'] = mcap
                            c['earnings_days'] = earnings_days
                            c['is_etf'] = is_etf
                            break
            except Exception as e:
                print(f"Error fetching fundamental chunk: {e}")
                
    # Filter out ETFs
    candidates = [c for c in candidates if not c.get('is_etf', False)]
                
    # Sort by Pattern Score first, then RS Rating
    candidates.sort(key=lambda x: (x['pattern_score'], x['rs_rating']), reverse=True)
    
    final_output = {
        "last_updated": datetime.datetime.now().isoformat(),
        "total_scanned": len(grouped),
        "results": candidates
    }
    
    class NumpyEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, np.integer): return int(obj)
            if isinstance(obj, np.floating): return float(obj)
            if isinstance(obj, np.ndarray): return obj.tolist()
            return super(NumpyEncoder, self).default(obj)
            
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(final_output, f, cls=NumpyEncoder)
        
    # Send Telegram Alert
    if len(candidates) > 0:
        try:
            from agents_engine import broadcast_telegram_alert
            top_5 = candidates[:5]
            msg = "🔥 *RS Line Scanner Alert* 🔥\n\n"
            for i, c in enumerate(top_5):
                msg += f"{i+1}. *{c['ticker']}* - RS Rating: {c['rs_rating']}\n"
                msg += f"   Badge: {c['rs_badge']} | Pattern: {c['pattern_status']}\n\n"
            
            broadcast_telegram_alert("RS_SCANNER", msg)
        except Exception as e:
            print(f"Failed to send telegram alert: {e}")
        
    print(f"RS Line Scanner Complete! Saved {len(candidates)} candidates to {OUTPUT_PATH}.")

if __name__ == "__main__":
    run_rs_scanner()
