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
from stock_personality_engine import classify_personality

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
    if not (0.08 <= cup_depth <= 0.42): # QUANT STRICT: Max cup depth 42%
        return {"status": "none", "score": 0, "details": {}}
        
    cup_duration = int(trough_idx - peak_idx)
    if cup_duration < 3: # min duration constraint
        return {"status": "none", "score": 0, "details": {}}
        
    right_side_data = rs_line.iloc[trough_idx+1:]
    if right_side_data.empty:
        return {"status": "none", "score": 0, "details": {}}
        
    right_rim_val = right_side_data.max()
    right_rim_idx = right_side_data.argmax() + trough_idx + 1
    
    # Right rim must recover to >= 80% of left rim (peak) - QUANT STRICT
    if right_rim_val < peak_val * 0.80:
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
    
    # Handle must be in upper half of the cup - QUANT STRICT
    cup_midpoint = trough_val + (peak_val - trough_val) * 0.50
    if handle_low < cup_midpoint:
        return {"status": "none", "score": 0, "details": {}}
        
    handle_depth = float((right_rim_val - handle_low) / right_rim_val)
    handle_duration = int(len(handle_data))
    
    # QUANT STRICT: Handle must be relatively tight (max 15%)
    if not (0.02 <= handle_depth <= 0.15) or handle_duration > 7:
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
            "handle_duration": handle_duration,
            "breakout_trigger": float(right_rim_val)
        }
    }

def compute_mansfield_rs(stock_series, benchmark_series, period=52):
    """
    Computes Mansfield Relative Strength (RS) line and slope.
    Formula: Base_RS = (Stock / Benchmark), Mansfield_RS = ((Base_RS / SMA(Base_RS, 52)) - 1) * 100
    """
    base_rs = stock_series / benchmark_series
    sma_base = base_rs.rolling(period, min_periods=10).mean()
    mansfield_rs = ((base_rs / sma_base) - 1.0) * 100.0
    return mansfield_rs

def calculate_adr(highs, lows):
    if len(highs) == 0: return 0
    adrs = (highs - lows) / lows
    return adrs.mean() * 100

def run_rs_scanner():
    print(f"Loading SPY and QQQ baselines from {LAKEHOUSE_PATH}...")
    
    # Load SPY and QQQ baselines
    spy_df = duckdb.query(f"SELECT Date as date, Close as close FROM '{LAKEHOUSE_PATH}' WHERE Ticker='SPY' ORDER BY Date").df()
    qqq_df = duckdb.query(f"SELECT Date as date, Close as close FROM '{LAKEHOUSE_PATH}' WHERE Ticker='QQQ' ORDER BY Date").df()
    
    if spy_df.empty:
        print("ERROR: SPY data not found in Lakehouse.")
        return
        
    spy_df['date'] = pd.to_datetime(spy_df['date'])
    spy_df.set_index('date', inplace=True)
    spy_weekly = spy_df.resample('W-FRI').last()

    qqq_df['date'] = pd.to_datetime(qqq_df['date'])
    qqq_df.set_index('date', inplace=True)
    qqq_weekly = qqq_df.resample('W-FRI').last()
    
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
    
    print("Loading Daily Data for 3-Day Blue Dot Detection...")
    daily_query = f"""
    SELECT 
        d.Ticker as ticker,
        d.Date as date,
        d.Close as close,
        d.High as high,
        s.Close as spy_close
    FROM '{LAKEHOUSE_PATH}' d
    JOIN '{LAKEHOUSE_PATH}' s ON d.Date = s.Date AND s.Ticker = 'SPY'
    WHERE d.Date >= CURRENT_DATE - INTERVAL 400 DAY
    ORDER BY d.Date
    """
    daily_df = duckdb.query(daily_query).df()
    daily_df['date'] = pd.to_datetime(daily_df['date'])
    daily_df['rs'] = daily_df['close'] / daily_df['spy_close']

    # Pre-compute 3-day Blue Dot metadata per ticker
    blue_dot_map = {}
    for t, g in daily_df.groupby('ticker'):
        if len(g) < 100: continue
        g_sorted = g.sort_values('date')
        rs_52w_max = g_sorted['rs'].rolling(250, min_periods=40).max()
        high_52w_price = g_sorted['high'].rolling(250, min_periods=40).max()
        
        rs_vs_high = (g_sorted['rs'] / rs_52w_max) * 100.0
        price_vs_high = (g_sorted['close'] / high_52w_price) * 100.0
        
        is_bd_series = (rs_vs_high >= 98.5) & (price_vs_high < 98.0)
        recent_3d = is_bd_series.iloc[-3:]
        
        if recent_3d.any():
            last_pos = np.where(recent_3d.values)[0][-1]
            days_ago = int(3 - last_pos - 1) # 0 = today, 1 = yesterday, 2 = 2d ago
            curr_c = float(g_sorted['close'].iloc[-1])
            h52 = float(high_52w_price.iloc[-1])
            lead_pct = round(((h52 / curr_c) - 1.0) * 100.0, 1) if curr_c > 0 else 0.0
            
            blue_dot_map[t] = {
                "is_blue_dot_3d": True,
                "blue_dot_days_ago": days_ago,
                "is_blue_dot_today": bool(is_bd_series.iloc[-1]),
                "blue_dot_lead_pct": lead_pct
            }

    print(f"Detected {len(blue_dot_map)} tickers with Blue Dots in the last 3 sessions.")
    print("Processing Weekly RS Lines with Multi-Timeframe Divergence & Blue Dot Detection...")
    
    rs_results = []
    grouped = all_stocks.groupby('ticker')
    
    total = len(grouped)
    idx = 0
    
    for ticker, df in grouped:
        idx += 1
        if idx % 1000 == 0: print(f"Processed {idx}/{total}...")
        
        df = df.copy()
        df.set_index('date', inplace=True)
        weekly = df
        
        # FILTER 1: Skip stocks with less than 52 weeks of data
        if len(weekly) < 52:
            continue
        
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
        
        # Ensure the 52-week high is at least 3 weeks old (avoid active breakouts)
        if weeks_since_high < 3:
            continue
            
        # FILTER: Skip stocks that have already broken out (>99% of high) or are too far away (<60% of high)
        if price_vs_high >= 99.0 or price_vs_high < 60.0:
            continue
            
        if weeks_since_high < 3:
            continue
            
        # Calculate Official William O'Neil IBD 1-Year Weighted Performance Formula:
        # IBD Weighted Return = 0.40 * Q1_Return + 0.20 * Q2_Return + 0.20 * Q3_Return + 0.20 * Q4_Return
        closes_len = len(weekly_52['close'])
        c = weekly_52['close']
        q1 = (c.iloc[-1] / c.iloc[-13] - 1.0) if closes_len >= 13 else 0.0
        q2 = (c.iloc[-13] / c.iloc[-26] - 1.0) if closes_len >= 26 else 0.0
        q3 = (c.iloc[-26] / c.iloc[-39] - 1.0) if closes_len >= 39 else 0.0
        q4 = (c.iloc[-39] / c.iloc[0] - 1.0) if closes_len >= 52 else 0.0
        ibd_perf = float(0.40 * q1 + 0.20 * q2 + 0.20 * q3 + 0.20 * q4)

        # Moving Average Extensions
        sma_10 = weekly_52['close'].rolling(10).mean().iloc[-1]
        sma_40 = weekly_52['close'].rolling(40).mean().iloc[-1]
        
        # FILTER: Skip severely collapsed or penny illiquid stocks
        if current_price < 3.0 or price_vs_high < 50.0:
            continue
            
        # Prevent Climax Extensions (> 50% above 40-week MA)
        if not pd.isna(sma_40) and (current_price / sma_40) > 1.50:
            continue
            
        # ADR% (over 20 weeks) & Personality Classification
        recent_20 = weekly_52.iloc[-20:]
        adr_pct = calculate_adr(recent_20['high'], recent_20['low'])
        pers = classify_personality(adr_pct, adr_pct)
        
        # Calculate Multi-Timeframe RS Peaks (1 bar = 1 week)
        rs_current = rs_ratio_normalized.iloc[-1]
        rs_peak_12m = rs_ratio_normalized.max()
        rs_peak_6m = rs_ratio_normalized.iloc[-26:].max() if len(rs_ratio_normalized) >= 26 else rs_peak_12m
        rs_peak_3m = rs_ratio_normalized.iloc[-13:].max() if len(rs_ratio_normalized) >= 13 else rs_peak_12m
        rs_peak_1m = rs_ratio_normalized.iloc[-4:].max() if len(rs_ratio_normalized) >= 4 else rs_peak_12m
        
        # Determine Multi-Timeframe Badge Status
        if (rs_current / rs_peak_12m) * 100 >= 98.5:
            rs_badge = "12M RS High"
        elif (rs_current / rs_peak_6m) * 100 >= 98.5:
            rs_badge = "6M RS High"
        elif (rs_current / rs_peak_3m) * 100 >= 98.5:
            rs_badge = "3M RS High"
        elif (rs_current / rs_peak_1m) * 100 >= 98.5:
            rs_badge = "1M RS High"
        else:
            rs_badge = "None"

        # RS Blue Dot Pivots Metadata (Checks 3-Day Rolling Window)
        bd_info = blue_dot_map.get(ticker, {
            "is_blue_dot_3d": False,
            "blue_dot_days_ago": None,
            "is_blue_dot_today": False,
            "blue_dot_lead_pct": 0.0
        })
        
        is_blue_dot = bd_info["is_blue_dot_3d"]
        is_blue_dot_today = bd_info["is_blue_dot_today"]
        blue_dot_days_ago = bd_info["blue_dot_days_ago"]
        blue_dot_lead_pct = bd_info["blue_dot_lead_pct"]

        # Cup and Handle Detection on STOCK PRICE
        ch_analysis = detect_rs_cup_and_handle(weekly_52['close'])
        
        # A stock is a valid IBD candidate if it has an RS New High (or Blue Dot in last 3d) OR a Base/Cup pattern
        if rs_badge == "None" and not is_blue_dot and ch_analysis['status'] == 'none':
            continue

        # Compute Mansfield RS & Slope vs SPY
        mansfield_series = compute_mansfield_rs(weekly_52['close'], spy_aligned['close'])
        curr_mansfield = float(mansfield_series.iloc[-1]) if not pd.isna(mansfield_series.iloc[-1]) else 0.0
        mansfield_5w_ago = float(mansfield_series.iloc[-6]) if (len(mansfield_series) >= 6 and not pd.isna(mansfield_series.iloc[-6])) else curr_mansfield
        mansfield_slope = round(curr_mansfield - mansfield_5w_ago, 2)

        # Multi-benchmark divergence vs QQQ
        qqq_aligned = qqq_weekly.reindex(weekly_52.index).ffill()
        rs_qqq_ratio = weekly_52['close'] / qqq_aligned['close']
        rs_qqq_normalized = rs_qqq_ratio / rs_qqq_ratio.iloc[0]
        rs_qqq_current = rs_qqq_normalized.iloc[-1]
        rs_qqq_peak_12m = rs_qqq_normalized.max()
        rs_qqq_vs_high = round((rs_qqq_current / rs_qqq_peak_12m) * 100, 1)

        rs_results.append({
            "ticker": ticker,
            "ibd_perf": ibd_perf,
            "rs_raw_return": (rs_ratio_normalized.iloc[-1] - 1.0) * 100,
            "rs_vs_high": round(rs_vs_high, 1),
            "rs_qqq_vs_high": rs_qqq_vs_high,
            "rs_badge": rs_badge,
            "is_blue_dot": is_blue_dot,
            "is_blue_dot_today": is_blue_dot_today,
            "blue_dot_days_ago": blue_dot_days_ago,
            "blue_dot_badge": "🔵 RS BLUE DOT PIVOT" if is_blue_dot else "NORMAL",
            "blue_dot_lead_pct": blue_dot_lead_pct,
            "mansfield_rs": round(curr_mansfield, 2),
            "mansfield_slope": mansfield_slope,
            "pattern_status": ch_analysis['status'],
            "pattern_score": ch_analysis['score'],
            "pattern_details": ch_analysis['details'],
            "adr_pct": adr_pct,
            "personality_tier": pers['tier'],
            "personality_label": pers['tier_label'],
            "personality_color": pers['tier_color'],
            "personality_sizing": pers['sizing_recommendation'],
            "sparkline": rs_ratio_normalized.round(3).tolist(),
            "price": float(weekly_52['close'].iloc[-1]),
            "volume_20w_avg": float(weekly_52['volume'].iloc[-20:].mean()),
            "current_volume": float(weekly_52['volume'].iloc[-1])
        })
        
    print(f"Scanned {len(rs_results)} stocks with 52-week histories.")
    
    # Calculate Official IBD RS Rating Percentile (1-99) using 1-Year Weighted Return
    ibd_perfs = [r['ibd_perf'] for r in rs_results]
    
    from scipy import stats
    percentiles = [stats.percentileofscore(ibd_perfs, r['ibd_perf']) for r in rs_results]
    
    candidates = []
    zacks_query_list = []
    
    for i, r in enumerate(rs_results):
        # Scale to integer 1 to 99 range
        r['rs_rating'] = max(1, min(99, int(round(percentiles[i]))))
        
        # Keep high-performance IBD setups (RS Rating >= 50, Blue Dot, RS Badge or Base Pattern)
        if r['rs_rating'] >= 50 or r['is_blue_dot'] or r['rs_badge'] != "None" or r['pattern_status'] != "none":
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
                fin_data = yq.financial_data
                
                for t in chunk:
                    mcap = 0
                    earnings_days = 999
                    is_etf = False
                    zacks_rank = 5
                    
                    rev_growth = 0
                    earn_growth = 0
                    peg_ratio = None
                    
                    if isinstance(fin_data, dict) and t in fin_data and isinstance(fin_data[t], dict):
                        rev_growth = fin_data[t].get('revenueGrowth', 0)
                        if rev_growth is None: rev_growth = 0
                        earn_growth = fin_data[t].get('earningsGrowth', 0)
                        if earn_growth is None: earn_growth = 0
                        
                    if isinstance(details, dict) and t in details and isinstance(details[t], dict):
                        peg_ratio = details[t].get('pegRatio')
                        
                    # Multi-Factor Zacks Rank Engine:
                    # Evaluates earnings acceleration, revenue growth, and valuation multiples
                    growth_metric = max(float(rev_growth), float(earn_growth))
                    
                    if growth_metric >= 0.40 or (growth_metric >= 0.25 and (peg_ratio is None or peg_ratio <= 2.0)):
                        zacks_rank = 1
                    elif growth_metric >= 0.18 or (growth_metric >= 0.10 and (peg_ratio is None or peg_ratio <= 3.0)):
                        zacks_rank = 2
                    elif growth_metric >= 0.05:
                        zacks_rank = 3
                    elif growth_metric >= -0.10:
                        zacks_rank = 4
                    else:
                        zacks_rank = 5
                    
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
                            c['zacks_rank'] = zacks_rank
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
            if isinstance(obj, (np.integer, int)): return int(obj)
            if isinstance(obj, (np.floating, float)): return float(obj)
            if isinstance(obj, (np.bool_, bool)): return bool(obj)
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
