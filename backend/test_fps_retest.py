import duckdb
import pandas as pd

lake_df = duckdb.query("SELECT * FROM read_parquet('/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet') WHERE Ticker='FPS' ORDER BY Date").to_df()
spy_df = duckdb.query("SELECT * FROM read_parquet('/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet') WHERE Ticker='SPY' ORDER BY Date").to_df()

spy_close = spy_df['Close']
high = lake_df['High']
low = lake_df['Low']
close = lake_df['Close']
open_s = lake_df['Open']
vol = lake_df['Volume']

base_highs = high.iloc[-70:-10]
pivot = base_highs.max()
recent_data = high.iloc[-10:-1]
recent_high = recent_data.max()

print(f"Pivot: {pivot}, Recent High: {recent_high}")

if recent_high > pivot:
    peak_idx = recent_data.values.argmax() 
    days_since_peak = len(recent_data) - peak_idx
    
    curr_l = low.iloc[-1]
    curr_h = high.iloc[-1]
    curr_c = close.iloc[-1]
    curr_o = open_s.iloc[-1]
    
    is_orderly_pullback = 2 <= days_since_peak <= 8
    print(f"Days since peak: {days_since_peak}, Orderly: {is_orderly_pullback}")
    
    cond_close = (pivot * 0.985 < curr_c <= pivot * 1.05)
    cond_low = (pivot * 0.97 <= curr_l <= pivot * 1.015)
    
    print(f"Close: {curr_c} (Target: {pivot*0.985} - {pivot*1.05}) -> {cond_close}")
    print(f"Low: {curr_l} (Target: {pivot*0.97} - {pivot*1.015}) -> {cond_low}")
    
    if is_orderly_pullback and cond_close and cond_low:
        lower_wick = min(curr_o, curr_c) - curr_l
        body = abs(curr_o - curr_c)
        total_range = curr_h - curr_l
        is_rejection = (lower_wick > body * 1.5) and (lower_wick > total_range * 0.35) if total_range > 0 else False
        print("--- Passed Proximity ---")
        
        atr_base = (high.iloc[-70:-10] - low.iloc[-70:-10]).mean()
        is_contracting = total_range <= atr_base * 1.2
        print(f"Contracting: {total_range} <= {atr_base*1.2} -> {is_contracting}")
        
        breakout_vol = vol.iloc[-10:-days_since_peak].max() if days_since_peak < 10 else vol.iloc[-10]
        avg_vol_50 = vol.iloc[-60:-10].mean()
        is_conviction_breakout = breakout_vol > avg_vol_50 * 1.5
        print(f"Conviction Breakout: {breakout_vol} > {avg_vol_50*1.5} -> {is_conviction_breakout}")
        
        pullback_vol = vol.iloc[-days_since_peak:].mean()
        vol_drying_up = pullback_vol < avg_vol_50 * 1.1
        print(f"Vol Drying Up: {pullback_vol} < {avg_vol_50*1.1} -> {vol_drying_up}")
        
        ema10 = close.ewm(span=10, adjust=False).mean().iloc[-1]
        ma_aligned = abs(ema10 - pivot) / pivot < 0.025
        print(f"MA Aligned: {ema10} vs {pivot} -> {ma_aligned}")
        
        rs_spy_10d = ((curr_c / spy_close.iloc[-1]) / (close.iloc[-10] / spy_close.iloc[-10]) - 1) * 100 if spy_close.iloc[-10] != 0 else 0
        rs_strong = rs_spy_10d > -2.0
        print(f"RS Strong: {rs_spy_10d} -> {rs_strong}")
        
        if is_contracting and vol_drying_up and is_conviction_breakout and ma_aligned and rs_strong:
            print(">>> A+ RETEST MET <<<")

