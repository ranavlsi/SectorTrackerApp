import yfinance as yf
import pandas as pd
import json
import os
import warnings

warnings.filterwarnings('ignore')

UNIVERSE = [
    'AAPL', 'MSFT', 'NVDA', 'AVGO', 'ADBE', 'BRK-B', 'JPM', 'V', 'MA', 'BAC',
    'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'LLY', 'UNH', 'JNJ', 'MRK', 'ABBV',
    'GE', 'CAT', 'UNP', 'BA', 'HON', 'AMZN', 'TSLA', 'HD', 'MCD', 'NKE',
    'PG', 'COST', 'WMT', 'PEP', 'KO', 'NEE', 'SO', 'DUK', 'SRE', 'AEP',
    'LIN', 'SHW', 'FCX', 'ECL', 'NEM', 'PLD', 'AMT', 'EQIX', 'CCI', 'PSA',
    'META', 'GOOGL', 'GOOG', 'NFLX', 'DIS', 'TSM', 'ASML', 'AMD', 'CRM', 'ORCL',
    'VRTX', 'REGN', 'AMGN', 'GILD', 'BIIB', 'DHI', 'LEN', 'NVR', 'PHM', 'TOL',
    'FSLR', 'ENPH', 'SEDG', 'RUN', 'IONQ', 'QBTS', 'RGTI', 'IBM', 'COIN', 'ROKU',
    # Recent high momentum / IPO names
    'PLTR', 'ASTS', 'HOOD', 'RDDT', 'ALAB', 'ARM', 'CAVA', 'SMCI', 'CELH'
]

import talib

CDL_PATTERNS = {
    'CDLMORNINGSTAR': 'Morning Star',
    'CDLEVENINGSTAR': 'Evening Star',
    'CDLABANDONEDBABY': 'Abandoned Baby',
    'CDLENGULFING': 'Engulfing',
    'CDL3WHITESOLDIERS': '3 White Soldiers',
    'CDL3BLACKCROWS': '3 Black Crows',
    'CDLPIERCING': 'Piercing Line',
    'CDLDARKCLOUDCOVER': 'Dark Cloud Cover',
    'CDLHOMINGPIGEON': 'Homing Pigeon',
    'CDLHIKKAKE': 'Hikkake',
    'CDLSTICKSANDWICH': 'Stick Sandwich',
    'CDLBREAKAWAY': 'Breakaway',
    'CDLUNIQUE3RIVER': 'Unique 3 River',
    'CDLCONCEALBABYSWALL': 'Conceal Baby Swallow',
    'CDLRISEFALL3METHODS': '3 Methods',
    'CDLMATHOLD': 'Mat Hold',
    'CDLTASUKIGAP': 'Tasuki Gap',
    'CDLSEPARATINGLINES': 'Separating Lines',
    'CDLSTALLEDPATTERN': 'Deliberation',
    'CDLGAPSIDESIDEWHITE': 'Side-by-Side White',
    'CDLGAPSIDESIDEWHITE': 'Side-by-Side White',
    'CDLHAMMER': 'Hammer'
}

def check_cup_and_handle(df, is_monthly=False):
    if df.empty or len(df) < 20: return False
    
    window = 24 if is_monthly else 52
    df_recent = df.iloc[-window:]
    if len(df_recent) < 15: return False
    
    # Handle is usually the last 1-4 periods
    handle_len = 2 if is_monthly else 4
    cup_data = df_recent.iloc[:-handle_len]
    handle_data = df_recent.iloc[-handle_len:]
    
    if len(cup_data) < 10 or len(handle_data) < 1: return False
    
    left_cup_high = cup_data['High'].max()
    left_cup_high_idx = cup_data['High'].values.argmax()
    
    if left_cup_high_idx >= len(cup_data) - 4:
        return False # No time to form the bottom and right side
        
    cup_bottom_data = cup_data.iloc[left_cup_high_idx:]
    cup_bottom = cup_bottom_data['Low'].min()
    cup_bottom_idx = cup_bottom_data['Low'].values.argmin() + left_cup_high_idx
    
    # Bottom cannot be the very end of the cup, need time for right side
    if cup_bottom_idx >= len(cup_data) - 2:
        return False
    
    cup_depth = (left_cup_high - cup_bottom) / left_cup_high
    if not (0.12 <= cup_depth <= 0.50): return False
    
    right_side_data = cup_data.iloc[cup_bottom_idx+1:]
    if right_side_data.empty: return False
    
    right_cup_high = right_side_data['High'].max()
    
    if right_cup_high < left_cup_high * 0.80: return False
    
    handle_low = handle_data['Low'].min()
    
    # Handle MUST be in the upper half of the cup
    if handle_low < cup_bottom + (left_cup_high - cup_bottom) * 0.5:
        return False
        
    handle_depth = (right_cup_high - handle_low) / right_cup_high
    
    if not (0.02 <= handle_depth <= 0.20): return False
    
    return True

def run_screener():
    print(f"Running Unified Expert Screener on {len(UNIVERSE)} stocks...")
    
    df = yf.download(UNIVERSE + ['SPY'], period='5y', interval='1d', group_by='ticker', progress=False)
    
    if df.empty or 'SPY' not in df:
        print("Failed to download data.")
        return
        
    spy_close = df['SPY']['Close'].dropna()
    max_days = len(spy_close)
    
    results = {
        "relative_strength": [],
        "fresh_52w_high": [],
        "all_time_high": [],
        "ipo_avwap": [],
        "bullish_candlestick": [],
        "bearish_candlestick": [],
        "early_stage_2": [],
        "darvas_breakout": [],
        "breakout_retest": [],
        "base_pullback_ma": [],
        "reversal": [],
        "hve_volume": [],
        "hve_consolidation": [],
        "post_earning_reaction": [],
        "post_earning_consolidation": [],
        "weekly_cup_handle": [],
        "monthly_cup_handle": []
    }
    
    for ticker in UNIVERSE:
        if ticker not in df: continue
        ticker_df = df[ticker].dropna()
        if ticker_df.empty: continue
        
        close = ticker_df['Close']
        open_s = ticker_df['Open']
        high = ticker_df['High']
        low = ticker_df['Low']
        vol = ticker_df['Volume']
        
        if len(close) < 20: continue
        
        curr_c = close.iloc[-1]
        
        # 1. Relative Strength
        try:
            rs_1mo = ((close.iloc[-1] / spy_close.iloc[-1]) / (close.iloc[-20] / spy_close.iloc[-20]) - 1) * 100
            if rs_1mo > 10:
                results["relative_strength"].append({"ticker": ticker, "metric": f"+{rs_1mo:.1f}% vs SPY"})
        except: pass
        
        # 2 & 3. 52-Week Highs & All-Time Highs
        if len(close) >= 252:
            high_52w = close.iloc[-252:].max()
            if curr_c >= high_52w * 0.98:
                results["fresh_52w_high"].append({"ticker": ticker, "metric": f"At High: ${curr_c:.2f}"})
        
        ath = close.max()
        if curr_c >= ath * 0.98:
            results["all_time_high"].append({"ticker": ticker, "metric": f"ATH: ${ath:.2f}"})
            
        # 4. True IPO AVWAP 
        # If the stock has significantly fewer trading days than SPY over the last 5 years, it's a recent IPO.
        if len(close) < max_days - 20: 
            tp = (high + low + close) / 3
            avwap = (tp * vol).cumsum() / vol.cumsum()
            curr_avwap = avwap.iloc[-1]
            # Must be bouncing off or holding just above AVWAP (within 3%)
            if abs(curr_c - curr_avwap) / curr_avwap < 0.03 and curr_c >= curr_avwap * 0.99:
                results["ipo_avwap"].append({"ticker": ticker, "metric": f"AVWAP: ${curr_avwap:.2f}"})
                
        # 5. Multi-Day Candlestick Patterns via TA-Lib
        has_bullish_candle = False
        for func_name, common_name in CDL_PATTERNS.items():
            func = getattr(talib, func_name)
            res = func(open_s, high, low, close)
            val = res.iloc[-1]
            if val > 0:
                results["bullish_candlestick"].append({"ticker": ticker, "metric": f"Bullish {common_name}"})
                has_bullish_candle = True
            elif val < 0:
                results["bearish_candlestick"].append({"ticker": ticker, "metric": f"Bearish {common_name}"})
            
        # 6. Early Stage 2 Breakout
        if len(close) >= 200:
            sma200 = close.rolling(200).mean()
            curr_sma = sma200.iloc[-1]
            prev_sma = sma200.iloc[-5]
            prev_c = close.iloc[-5]
            
            # Price crossed above 200 SMA in last 5 days
            if prev_c < prev_sma and curr_c > curr_sma:
                results["early_stage_2"].append({"ticker": ticker, "metric": f"Crossed 200 SMA (${curr_sma:.2f})"})
                
        # 7. Darvas Breakout
        if len(close) >= 252:
            high_52w = close.iloc[-252:].max()
            avg_vol = vol.iloc[-20:].mean()
            curr_vol = vol.iloc[-1]
            if curr_c >= high_52w * 0.98 and curr_vol > avg_vol * 1.5:
                results["darvas_breakout"].append({"ticker": ticker, "metric": f"Breakout Volume: {curr_vol/avg_vol:.1f}x"})
                
        # 7.5 Breakout Retest & Squat MA Support
        if len(high) >= 70:
            # Pivot is the max high from 70 days ago up to 10 days ago (the base)
            pivot = high.iloc[-70:-10].max()
            recent_high = high.iloc[-10:-1].max()
            
            # Did we breakout recently?
            if recent_high > pivot:
                # Breakout Retest: Price is still above pivot, but pulled back to touch it within 1.5%
                if curr_c > pivot * 0.99 and low.iloc[-1] <= pivot * 1.015:
                    results["breakout_retest"].append({"ticker": ticker, "metric": f"Retesting Pivot: ${pivot:.2f}"})
                
                # Fell into Base & Found Support on Short Term MA (10 or 20)
                sma10 = close.rolling(10).mean().iloc[-1]
                sma20 = close.rolling(20).mean().iloc[-1]
                curr_l = low.iloc[-1]
                
                # Fell back below pivot
                if curr_c < pivot:
                    # Found support on 10 SMA
                    if curr_l <= sma10 and curr_c >= sma10 * 0.99:
                        results["base_pullback_ma"].append({"ticker": ticker, "metric": f"Squat Support at 10-SMA (${sma10:.2f})"})
                    # Found support on 20 SMA
                    elif curr_l <= sma20 and curr_c >= sma20 * 0.99:
                        results["base_pullback_ma"].append({"ticker": ticker, "metric": f"Squat Support at 20-SMA (${sma20:.2f})"})
                
        # 8. Reversal
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        # Broader Reversal: RSI < 40 (Oversold) AND any Bullish Candlestick
        if not rsi.empty and rsi.iloc[-1] < 40 and has_bullish_candle:
            results["reversal"].append({"ticker": ticker, "metric": f"RSI {rsi.iloc[-1]:.1f} + Bullish Candle"})
            
        # 9. High Volume Event (HVE)
        avg_vol = vol.iloc[-50:].mean()
        curr_vol = vol.iloc[-1]
        if curr_vol > avg_vol * 3:
            results["hve_volume"].append({"ticker": ticker, "metric": f"{curr_vol/avg_vol:.1f}x Avg Vol"})
            
        # 10. Consolidation after HVE
        # Did an HVE happen in the last 15 days (but not today)?
        hve_mask = vol.iloc[-15:-1] > vol.iloc[-65:-15].mean() * 2.5
        if hve_mask.any():
            # Range over last 4 days is tight (< 5%)
            recent_max = high.iloc[-4:].max()
            recent_min = low.iloc[-4:].min()
            if (recent_max - recent_min) / recent_min < 0.05:
                results["hve_consolidation"].append({"ticker": ticker, "metric": "Tight < 5% Range"})
                
        # 11. Post Earning Positive Reaction & Consolidation
        # Define earnings reaction technically: Gap Up > 4% and Volume > 2.5x average
        if len(close) > 65:
            avg_vol_50 = vol.iloc[-70:-20].mean()
            # Loop through the last 20 days to find a Power Earnings Gap
            peg_found = False
            for i in range(-20, -1):
                prev_c = close.iloc[i-1]
                day_o = open_s.iloc[i]
                day_c = close.iloc[i]
                day_v = vol.iloc[i]
                
                # Gap > 4%, Vol > 2.5x, closed positive relative to open
                if day_o > prev_c * 1.04 and day_v > avg_vol_50 * 2.5 and day_c >= day_o * 0.99:
                    peg_found = True
                    days_since = abs(i) - 1
                    
                    if days_since <= 5:
                        # Happened recently
                        results["post_earning_reaction"].append({"ticker": ticker, "metric": f"Gap Up +{((day_o/prev_c)-1)*100:.1f}%"})
                    else:
                        # Happened 6-20 days ago, check if consolidating (holding the gap)
                        # Current price must be above the gap day's low, and below gap day's high * 1.05
                        gap_low = low.iloc[i]
                        recent_max = high.iloc[i:] .max()
                        if curr_c > gap_low and recent_max < day_c * 1.10:
                            results["post_earning_consolidation"].append({"ticker": ticker, "metric": f"Holding Gap {days_since}d"})
                    break # Stop looking after finding the most recent one

        # 12. Cup and Handle (Weekly & Monthly)
        try:
            # Resample to Weekly
            weekly_df = ticker_df.resample('W').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
            if check_cup_and_handle(weekly_df, is_monthly=False):
                results["weekly_cup_handle"].append({"ticker": ticker, "metric": "Weekly Cup & Handle"})
                
            # Resample to Monthly
            monthly_df = ticker_df.resample('ME').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
            if check_cup_and_handle(monthly_df, is_monthly=True):
                results["monthly_cup_handle"].append({"ticker": ticker, "metric": "Monthly Cup & Handle"})
        except Exception as e:
            pass

    # Sort results to only keep top 10 per category to keep UI clean
    for key in results:
        results[key] = results[key][:10]
        
    output_path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/screener_results.json'
    with open(output_path, 'w') as f:
        json.dump(results, f)
        
    print(f"Successfully wrote screener results to {output_path}")

if __name__ == "__main__":
    run_screener()
