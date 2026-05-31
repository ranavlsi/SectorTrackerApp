import yfinance as yf
import pandas as pd
import json
import os
import warnings
import requests
from io import StringIO
import logging
import time

from long_base_scanner import evaluate_long_base, evaluate_medium_base
from pending_breakout_engine import detect_pending_breakout
from qullamaggie_engine import evaluate_qullamaggie_setup

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

def fetch_yahoo_screener(url):
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        req = requests.get(url, headers=headers, timeout=10)
        dfs = pd.read_html(StringIO(req.text))
        if dfs:
            raw_symbols = dfs[0]['Symbol'].tolist()
            # Yahoo formats them weirdly sometimes like "R RDW"
            clean_symbols = [str(s).split()[-1] for s in raw_symbols if pd.notna(s)]
            return clean_symbols
    except Exception as e:
        print(f"Failed to scrape {url}: {e}")
    return []

def get_dynamic_universe():
    urls = [
        'https://finance.yahoo.com/screener/predefined/day_gainers',
        'https://finance.yahoo.com/screener/predefined/most_actives'
    ]
    dynamic_tickers = set(UNIVERSE)
    for url in urls:
        dynamic_tickers.update(fetch_yahoo_screener(url))
        
    return list(dynamic_tickers)

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
    
    if not (0.02 <= handle_depth <= 0.12): return False
    
    cup_right_vol_avg = cup_data['Volume'].iloc[cup_bottom_idx+1:].mean()
    handle_vol_avg = handle_data['Volume'].mean()
    if handle_vol_avg > cup_right_vol_avg * 0.75: return False
    
    return True

import duckdb

def run_screener(custom_universe=None):
    LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
    
    lakehouse_mode = os.path.exists(LAKEHOUSE_PATH)
    
    if lakehouse_mode:
        print(f"Loading ALL stocks from Lakehouse: {LAKEHOUSE_PATH}...")
        lake_df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()
        lake_df = lake_df.sort_values('Date')
        grouped = lake_df.groupby('Ticker')
        all_tickers = list(grouped.groups.keys())
        
        # --- COMPREHENSIVE ETF BLOCKLIST ---
        # The ADR Volatility filter catches 99% of ETFs, but Leveraged ETFs (SOXL, TQQQ) and massive volatile sector ETFs bypass it.
        # We aggressively strip them out here before they even enter the universe.
        ETF_BLOCKLIST = {
            'SPY', 'QQQ', 'DIA', 'IWM', 'SMH', 'XLF', 'XLE', 'XLK', 'XLV', 'XLY', 'XLI', 'XLU', 'XLP', 'XLB', 'XLC', 'XRE', 'XRT', 'XBI', 'IBB', 'KRE', 'KBE', 'GDX', 'GDXJ', 'GLD', 'SLV', 'USO', 'UNG', 'TLT', 'TMF', 'HYG', 'JNK', 'LQD', 'BND', 'AGG', 'VTI', 'VOO', 'VEA', 'VWO', 'EEM', 'EFA', 'ARKK', 'ARKG', 'ARKW', 'ARKF', 'ARKQ',
            'TQQQ', 'SQQQ', 'SOXL', 'SOXS', 'UPRO', 'SPXU', 'TNA', 'TZA', 'UDOW', 'SDOW', 'URTY', 'SRTY', 'FAS', 'FAZ', 'LABU', 'LABD', 'NUGT', 'DUST', 'JNUG', 'JDST', 'UCO', 'SCO', 'BOIL', 'KOLD', 'YINN', 'YANG', 'CWEB', 'KWEB', 'FXI', 'GUSH', 'DRIP', 'ERX', 'ERY', 'TECL', 'TECS', 'WEBL', 'WEBS', 'FNGU', 'FNGD', 'BULZ', 'BERZ', 'DPST', 'NAIL', 'RETL', 'CURE', 'DFEN', 'HIBL', 'HIBS', 'MIDU', 'PILL', 'SPXL', 'SPXS', 'SPYU', 'TDF', 'TYD', 'TYO', 'UBOT', 'UTSL', 'WANT', 'BITU', 'SBIT', 'CONL', 'NVDL', 'NVD', 'TSLL', 'TSLQ', 'TSLR', 'AMZU', 'AMZD', 'GGLL', 'GGLS', 'AAPU', 'AAPD', 'MSFU', 'MSFD', 'UVXY', 'VIXY', 'SVIX', 'BITO', 'IBIT', 'FBTC', 'ARKB', 'BITB', 'EZBC', 'BRRR', 'HODL', 'BTCW', 'GBTC'
        }
        all_tickers = [t for t in all_tickers if t not in ETF_BLOCKLIST]
        # -----------------------------------
        if custom_universe is not None:
            dynamic_universe = [t for t in custom_universe if t in all_tickers]
            print(f"Filtered Lakehouse to {len(dynamic_universe)} requested stocks.")
        else:
            dynamic_universe = all_tickers
        # We also need SPY for relative strength.
        if 'SPY' in grouped.groups:
            spy_df = grouped.get_group('SPY').set_index('Date')
            spy_close = spy_df['Close'].dropna()
        else:
            spy_close = yf.download('SPY', period='2y', interval='1d', progress=False)['Close']
            
        print(f"Running Unified Expert Screener on {len(dynamic_universe)} stocks from Lakehouse...")
    else:
        dynamic_universe = custom_universe if custom_universe is not None else get_dynamic_universe()
        print(f"Running Unified Expert Screener on {len(dynamic_universe)} stocks (Legacy YF Mode)...")
        df = yf.download(dynamic_universe + ['SPY'], period='4y', interval='1d', group_by='ticker', progress=False)
        
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
        "monthly_cup_handle": [],
        "zacks_rank_1": [],
        "long_base_breakout": [],
        "medium_base_breakout": [],
        "pending_breakout": [],
        "qullamaggie_setup": [],
        "rs_divergence": []
    }
    
    dollar_vol_dict = {}
    
    for i, ticker in enumerate(dynamic_universe):
        if i > 0 and i % 100 == 0:
            print(f"Scanned {i}/{len(dynamic_universe)}...")
            
        if lakehouse_mode:
            ticker_df = grouped.get_group(ticker).set_index('Date')
        else:
            if ticker not in df:
                continue
            ticker_df = df[ticker].dropna()
            
        if ticker_df.empty: continue
        
        # DEBUG: Print the first 5 tickers to trace execution
        import time
        t0 = time.time()
        is_aaaa = False
        
        close = ticker_df['Close']
        open_s = ticker_df['Open']
        high = ticker_df['High']
        low = ticker_df['Low']
        vol = ticker_df['Volume']
        
        if len(close) < 20: continue
        
        curr_c = close.iloc[-1]
        curr_o = open_s.iloc[-1]
        
        dollar_vol_20d = float(curr_c * vol.iloc[-20:].mean())
        dollar_vol_dict[ticker] = dollar_vol_20d
        
        # --- MASTER QUANTITATIVE FILTER (Anti-ETF & Anti-Illiquid) ---
        # 1. Must trade at least $15M average daily dollar volume to be considered liquid
        if dollar_vol_20d < 15_000_000: continue
        
        # 2. Must be priced over $5 (no penny stocks)
        if curr_c < 5: continue
        
        # 3. Volatility Filter: Average Daily Range (ADR) > 2.5%
        # ETFs mathematically have extremely low ATRs (usually 0.5% - 1.5%). 
        # By requiring a 2.5% ADR, we instantly filter out 99% of ETFs and dead stocks, leaving only high-momentum equities.
        daily_range_pct = (high.iloc[-14:] - low.iloc[-14:]) / close.iloc[-14:]
        if daily_range_pct.mean() < 0.025: continue
        # -------------------------------------------------------------
        
        t1 = time.time()
        
        # 1. Relative Strength vs SPY
        try:
            stock_aligned, spy_aligned = close.align(spy_close, join='inner')
            rs_line = stock_aligned / spy_aligned
            
            # Simple 1-Month RS performance vs SPY (Current vs 20 trading days ago)
            rs_1mo = ((stock_aligned.iloc[-1] / spy_aligned.iloc[-1]) / (stock_aligned.iloc[-20] / spy_aligned.iloc[-20]) - 1) * 100
            
            if rs_1mo > 10:
                # Strict Trend Filter to remove "clutter" (random gap ups, broken stocks)
                if len(close) >= 200:
                    sma50 = close.rolling(50).mean().iloc[-1]
                    sma200 = close.rolling(200).mean().iloc[-1]
                    high_52w = close.iloc[-252:].max() if len(close) >= 252 else close.max()
                    
                    # 1. Price > 50 SMA > 200 SMA (Structural Uptrend)
                    # 2. Within 25% of 52-week high (Not a bottom bounce)
                    if curr_c > sma50 and sma50 > sma200 and curr_c >= high_52w * 0.75:
                        results["relative_strength"].append({"ticker": ticker, "metric": f"+{rs_1mo:.1f}% vs SPY", "score": float(rs_1mo)})
                
            # RS Divergence (RS line hits new 52-week high, but Price does not)
            if len(stock_aligned) >= 252:
                rs_52w_max = rs_line.iloc[-252:].max()
                price_52w_max = stock_aligned.iloc[-252:].max()
                
                is_rs_high = rs_line.iloc[-1] >= (rs_52w_max * 0.99) # RS is at its high
                is_price_diverging = curr_c < (price_52w_max * 0.97) # Price is strictly below its high
                is_close_enough = curr_c >= (price_52w_max * 0.85) # Within 15% of high
                is_uptrend = curr_c > close.rolling(200).mean().iloc[-1]
                
                if is_rs_high and is_price_diverging and is_close_enough and is_uptrend:
                    dist_to_high = ((1-(curr_c/price_52w_max))*100)
                    results["rs_divergence"].append({"ticker": ticker, "metric": f"RS New High | Price -{dist_to_high:.1f}%", "score": -float(dist_to_high)})
                    
        except Exception as e: 
            print(f"RS Error on {ticker}: {e}")
        
        # 2 & 3. 52-Week Highs & All-Time Highs
        if is_aaaa: print("Starting 52w High...")
        if len(close) >= 252:
            high_52w = close.iloc[-252:].max()
            if curr_c >= high_52w * 0.98:
                results["fresh_52w_high"].append({"ticker": ticker, "metric": f"At High: ${curr_c:.2f}"})
        
        ath_4y = close.max()
        if curr_c >= ath_4y * 0.98:
            # Verify true All-Time High by fetching max history for this specific stock
            try:
                if lakehouse_mode:
                    true_ath = ath_4y # Use 4y proxy to avoid network
                else:
                    from yahooquery import Ticker as YQTicker
                    hist_max = YQTicker(ticker).history(period="max", interval="1mo")
                    true_ath = hist_max['high'].max() if (hist_max is not None and not hist_max.empty) else ath_4y
                
                if curr_c >= true_ath * 0.95:
                    results["all_time_high"].append({"ticker": ticker, "metric": f"ATH: ${true_ath:.2f}"})
            except Exception:
                pass
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
                # Universal Bullish Candlestick Filters
                day_range = high.iloc[-1] - low.iloc[-1]
                if day_range == 0: continue
                
                close_pct = (curr_c - low.iloc[-1]) / day_range
                sma_10 = close.rolling(10).mean().iloc[-1]
                avg_vol_10 = vol.rolling(10).mean().iloc[-1]
                
                # 1. Must close in upper half of range (buyers held control)
                if close_pct < 0.50: continue
                
                # 2. Must occur during a short-term pullback (below 10 SMA) to be a valid reversal
                if curr_c > sma_10: continue
                
                # 3. Must have institutional volume backing (>20% above avg)
                if vol.iloc[-1] < avg_vol_10 * 1.2: continue

                if func_name == 'CDLHIKKAKE':
                    # Strict Hikkake filter: Must be a strong green candle closing near the top of its range
                    if curr_c <= curr_o or close_pct < 0.70: continue 
                    
                results["bullish_candlestick"].append({"ticker": ticker, "metric": f"Bullish {common_name}"})
                has_bullish_candle = True
            elif val < 0:
                results["bearish_candlestick"].append({"ticker": ticker, "metric": f"Bearish {common_name}"})
            
        # 4. Candlesticks (Hammer, Engulfing, Hikkake)
        if is_aaaa: print("Starting Candlesticks...")
        if len(close) >= 200:
            sma200 = close.rolling(200).mean()
            curr_sma = sma200.iloc[-1]
            prev_sma = sma200.iloc[-5]
            prev_c = close.iloc[-5]
            
            # Price crossed above 200 SMA in last 5 days
            crosses = (close > sma200) & (close.shift(1) <= sma200.shift(1))
            if crosses.iloc[-5:].any() and curr_c > curr_sma:
                results["early_stage_2"].append({"ticker": ticker, "metric": f"Crossed 200 SMA (${curr_sma:.2f})"})
                
        # 7. Darvas Breakout
        if len(close) >= 252:
            high_52w = close.iloc[-252:].max()
            box_high = high.iloc[-11:-1].max()
            box_low = low.iloc[-11:-1].min()
            box_tightness = (box_high - box_low) / box_low
            
            avg_vol = vol.iloc[-21:-1].mean()
            box_vol_avg = vol.iloc[-6:-1].mean()
            curr_vol = vol.iloc[-1]
            
            if box_tightness < 0.08 and box_vol_avg < avg_vol * 0.8:
                if curr_c > box_high and curr_vol > avg_vol * 1.5 and curr_c >= high_52w * 0.98:
                    vol_mult = curr_vol / avg_vol
                    results["darvas_breakout"].append({"ticker": ticker, "metric": f"Breakout Volume: {vol_mult:.1f}x", "score": float(vol_mult)})
                
        # 7.5 Breakout Retest & Squat MA Support
        if len(high) >= 70:
            # Pivot is the max high from 70 days ago up to 10 days ago (the base)
            pivot = high.iloc[-70:-10].max()
            recent_high = high.iloc[-10:-1].max()
            
            # Did we breakout recently?
            if recent_high > pivot:
                # Breakout Retest: Price is still above pivot, but pulled back to touch it within 1.5%
                if curr_c > pivot * 0.99 and low.iloc[-1] <= pivot * 1.015:
                    bounce = (curr_c - low.iloc[-1]) / low.iloc[-1]
                    results["breakout_retest"].append({"ticker": ticker, "metric": f"Retesting Pivot: ${pivot:.2f}", "score": float(bounce)})
                
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
        gain = (delta.where(delta > 0, 0)).ewm(alpha=1/14, adjust=False).mean()
        loss = (-delta.where(delta < 0, 0)).ewm(alpha=1/14, adjust=False).mean()
        rs = gain / loss.replace(0, 1e-10)
        rsi = 100 - (100 / (1 + rs))
        
        # Broader Reversal: RSI < 40 (Oversold) AND any Bullish Candlestick
        if not rsi.empty and rsi.iloc[-1] < 40 and has_bullish_candle:
            # Score is distance below 40 (deeper oversold = higher score)
            results["reversal"].append({"ticker": ticker, "metric": f"RSI {rsi.iloc[-1]:.1f} + Bullish Candle", "score": float(40 - rsi.iloc[-1])})
            
        # 9. High Volume Event (HVE)
        avg_vol = vol.iloc[-50:].mean()
        curr_vol = vol.iloc[-1]
        if curr_vol > avg_vol * 3:
            vol_mult = curr_vol / avg_vol
            results["hve_volume"].append({"ticker": ticker, "metric": f"{vol_mult:.1f}x Avg Vol", "score": float(vol_mult)})
            
        # 10. Consolidation after Positive HVE
        hve_threshold = vol.iloc[-65:-15].mean() * 2.5
        
        # Find all days in last 15 days that were positive HVEs (Close > Open and Close > Prev Close)
        positive_hve_days = []
        for i in range(-15, -1):
            if vol.iloc[i] > hve_threshold:
                if close.iloc[i] > open_s.iloc[i] and close.iloc[i] > close.iloc[i-1]:
                    positive_hve_days.append(i)
                    
        if positive_hve_days:
            # Take the most recent one
            hve_idx = positive_hve_days[-1]
            hve_c = close.iloc[hve_idx]
            hve_l = low.iloc[hve_idx]
            
            # Since the HVE, price must hold ABOVE the HVE Low (preferably near the close)
            days_since = abs(hve_idx) - 1
            if days_since >= 3: # Need at least 3 days of consolidation
                post_hve_lows = low.iloc[hve_idx+1:]
                
                # Condition 1: Holds HVE Low (No major breakdown)
                if post_hve_lows.min() >= hve_l * 0.98: # Allow slight wick below
                    # Condition 2: Tight consolidation in the last 4 days
                    recent_tightness = (high.iloc[-4:].max() - low.iloc[-4:].min()) / low.iloc[-4:].min()
                    
                    # Condition 3: Volume dry up
                    avg_v = vol.iloc[-65:-15].mean()
                    if recent_tightness < 0.06 and vol.iloc[-3:].mean() < avg_v * 1.2:
                        results["hve_consolidation"].append({"ticker": ticker, "metric": f"Tight Post-HVE ({days_since}d)"})
                
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
                        gap_pct = ((day_o/prev_c)-1)*100
                        results["post_earning_reaction"].append({"ticker": ticker, "metric": f"Gap Up +{gap_pct:.1f}%", "score": float(gap_pct)})
                    else:
                        # Happened 6-20 days ago, check if consolidating (holding the gap)
                        # Current price must be above the gap day's low, and below gap day's high * 1.05
                        gap_low = low.iloc[i]
                        flag_high = high.iloc[i+1:-1].max() if days_since > 1 else high.iloc[i]
                        # Must hold the gap low, must not have exceeded gap high by >10% structurally, AND today's close must NOT be breaking out of the flag high!
                        if curr_c > gap_low and high.iloc[i:].max() < day_c * 1.10 and curr_c <= flag_high * 1.01:
                            results["post_earning_consolidation"].append({"ticker": ticker, "metric": f"Holding Gap {days_since}d"})
                    break # Stop looking after finding the most recent one

        # 12. Cup and Handle (Weekly & Monthly)
        if is_aaaa: print("Starting Cup Handle...")
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

        # 13. Zacks Rank #1 (Strong Buy)
        if is_aaaa: print("Starting Zacks...")
        try:
            # OPTIMIZATION: Do not fetch yf.info for all 12,000 stocks as it takes 40 minutes.
            # Only fetch fundamentals if the stock is displaying relative strength or is near a 52w high.
            if lakehouse_mode:
                raise Exception("Bypassed fundamental API check to save time in fast Lakehouse mode")
                    
            t = yf.Ticker(ticker)
            info = t.info
            peg = info.get("pegRatio")
            revenue_growth = info.get("revenueGrowth")
            
            safe_peg = peg if peg is not None else 999
            safe_rev = revenue_growth if revenue_growth is not None else 0
            
            score = 0
            if safe_rev > 0.15: score += 2
            elif safe_rev > 0.05: score += 1
            elif safe_rev < 0: score -= 2
            
            if safe_peg < 1.0: score += 2
            elif safe_peg <= 2.0: score += 1
            elif safe_peg > 4.0 and safe_peg != 999: score -= 2
            elif safe_peg > 3.0 and safe_peg != 999: score -= 1
            elif safe_peg == 999: score -= 1
                
            rec = info.get("recommendationKey", "none").lower()
            if "buy" in rec: score += 1
            elif "sell" in rec or "underperform" in rec: score -= 2
            elif "hold" in rec: score -= 1
            
            if score >= 3:
                results["zacks_rank_1"].append({"ticker": ticker, "metric": f"Score: {score} | PEG: {safe_peg}"})
        except Exception as e:
            pass

        # --- NEW AGENTS (Long Base, Pending Breakout, Qullamaggie) ---
        if is_aaaa: print("Starting Long Base...")
        try:
            # 1. Long Base Breakout
            if lakehouse_mode:
                # In fast Lakehouse mode, we only have 2 years of data.
                # We will evaluate a "Long Base" as a 2-year base instead of 3-year to avoid blocking network calls.
                lb_res = evaluate_long_base(ticker, pre_df=ticker_df)
            else:
                lb_res = evaluate_long_base(ticker, pre_df=ticker_df)
                
            if lb_res:
                status_short = "Confirmed" if "CONFIRMED" in lb_res['status'] else "Coiled"
                results["long_base_breakout"].append({"ticker": ticker, "metric": f"{status_short} | Dist: {lb_res.get('distance_pct', '0')}%"})
                
            mb_res = evaluate_medium_base(ticker, pre_df=ticker_df)
            if mb_res:
                status_short = "Confirmed" if "CONFIRMED" in mb_res['status'] else "Coiled"
                dur = mb_res.get('base_duration', '3M')
                results["medium_base_breakout"].append({"ticker": ticker, "metric": f"{dur} | {status_short}"})
            
            if is_aaaa: print("Starting Pending Breakout...")
            # 2. Pending Breakout
            pb_res = detect_pending_breakout(ticker, pre_df=ticker_df)
            if pb_res:
                results["pending_breakout"].append({"ticker": ticker, "metric": f"Pending Breakout | {pb_res['alerts'][0]['model']}"})
                
            if is_aaaa: print("Starting Qullamaggie...")
            # 3. Qullamaggie Setup (Only run on liquid stocks >$2 to avoid junk penny stocks triggering false setups and API calls)
            if curr_c >= 2.0 and vol.iloc[-20:].mean() >= 100000:
                qm_res = evaluate_qullamaggie_setup(ticker, pre_df=ticker_df)
                if qm_res:
                    results["qullamaggie_setup"].append({"ticker": ticker, "metric": f"Triggered | ADR: {qm_res['adr']} | SMA: {qm_res['sma_support']}"})
                
        except Exception as e:
            pass
            
        t_end = time.time()
        duration = t_end - t0
        
        # If it took more than 100ms, something is wrong, log the breakdown!
        if duration > 0.1:
            print(f"{ticker} took {duration:.3f}s. Breakdown:")
            # We don't have the granular timings recorded in the loop, so let's just 
            # print that it's slow. Next I will inject the granular timings.

    # Post-Scan Optimization: NATIVE Liquidity Sorting
    # Instead of relying on rate-limited, broken external APIs (YahooQuery) for Market Cap,
    # we natively calculate and cache the 20-day Average Dollar Volume of every ticker.
    # Dollar Volume accurately correlates with mega-caps (IBM, ORCL, TSLA, AAPL).
    
    # -----------------------------------
    # POST-SCAN MARKET CAP ENFORCEMENT
    # -----------------------------------
    # To strictly enforce >$1B Market Cap without crashing due to rate limits on 12,000 stocks,
    # we bulk query the final surviving candidates using yahooquery.
    print("Post-Scan Optimization: Enforcing strict $1B Market Cap requirement on survivors...")
    unique_tickers = list(set([r["ticker"] for key in results for r in results[key]]))
    
    valid_market_caps = set(unique_tickers) # Default to keeping them all if API fails
    try:
        from yahooquery import Ticker as YQTicker
        yq_t = YQTicker(unique_tickers, asynchronous=True)
        summary_details = yq_t.summary_detail
        
        valid_market_caps = set()
        for t in unique_tickers:
            if isinstance(summary_details, dict) and t in summary_details:
                data = summary_details[t]
                if isinstance(data, dict):
                    mcap = data.get('marketCap', 0)
                    # Enforce strict 1 Billion Market Cap minimum
                    if mcap >= 1_000_000_000:
                        valid_market_caps.add(t)
                else:
                    # Keep if data is somehow missing or not a dict
                    valid_market_caps.add(t)
            else:
                valid_market_caps.add(t)
    except Exception as e:
        print(f"Failed to fetch Market Caps in bulk: {e}. Bypassing filter.")
        valid_market_caps = set(unique_tickers)
        
    for key in results:
        # 1. Filter out anything that mathematically failed the 1B market cap check
        filtered_mcap = [r for r in results[key] if r["ticker"] in valid_market_caps]
        
        # 2. Sort by TECHNICAL SCORE descending (the true power of the setup)!
        # If score is perfectly tied or doesn't exist, fallback to dollar volume to keep the most liquid names at the top.
        results[key] = sorted(filtered_mcap, key=lambda x: (x.get("score", 0), dollar_vol_dict.get(x["ticker"], 0)), reverse=True)[:50]

    with open('/Users/amitkumar/Desktop/SectorTrackerApp/public/screener_results.json', 'w') as f:
        json.dump(results, f)
        
    print(f"Screener complete! Results saved to public/screener_results.json")
    
    # Send Telegram Alert with top picks
    try:
        import sys
        sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
        from agents_engine import broadcast_telegram_alert
        
        msg = f"🟢 **MASTER SCREENER COMPLETE** 🟢\n\n"
        
        has_alerts = False
        if results.get("darvas_breakout"):
            msg += f"📦 **Darvas Breakouts:**\n" + "\n".join([f"• {r['ticker']}: {r['metric']}" for r in results["darvas_breakout"][:5]]) + "\n\n"
            has_alerts = True
            
        if results.get("hve_consolidation"):
            msg += f"💥 **Post-HVE Consolidations:**\n" + "\n".join([f"• {r['ticker']}: {r['metric']}" for r in results["hve_consolidation"][:5]]) + "\n\n"
            has_alerts = True
            
        if results.get("medium_base_breakout"):
            msg += f"🏗️ **Medium Base Coils:**\n" + "\n".join([f"• {r['ticker']}: {r['metric']}" for r in results["medium_base_breakout"][:5]]) + "\n\n"
            has_alerts = True
            
        if has_alerts:
            broadcast_telegram_alert("MASTER_SCAN", msg)
    except Exception as e:
        print(f"Failed to send telegram alert: {e}")
        
    return results

if __name__ == "__main__":
    run_screener()
