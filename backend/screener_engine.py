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
from darvas_box_scanner import calculate_darvas_box
from bull_flag_scanner import detect_bull_flag
from earnings_surprise_scanner import evaluate_earnings_surprise
from regression_channel_scanner import evaluate_regression_channel
from fvg_sma_scanner import evaluate_fvg_sma_confluence
from volume_profile_scanner import evaluate_volume_profile_rejections, evaluate_val_rejection

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
        if custom_universe is not None:
            dynamic_universe = [t for t in custom_universe if t in all_tickers]
            print(f"Filtered Lakehouse to {len(dynamic_universe)} requested stocks.")
        else:
            dynamic_universe = all_tickers
            print(f"Running Unified Expert Screener on all {len(dynamic_universe)} stocks in Lakehouse (expect ~10 mins)...")
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
    
    print("Calculating Market Breadth & Health Regime...")
    try:
        from advanced_quant_utils import MarketHealthMonitor, AdaptiveScreener
        spy_df_full = pd.DataFrame({'Close': spy_close})
        spy_df_full['SMA_50'] = spy_df_full['Close'].rolling(50).mean()
        spy_df_full['SMA_200'] = spy_df_full['Close'].rolling(200).mean()
        
        if lakehouse_mode:
            # Fast vectorized breadth calculation
            lake_df['SMA_50'] = lake_df.groupby('Ticker')['Close'].transform(lambda x: x.rolling(50).mean())
            last_date = lake_df['Date'].max()
            today_df = lake_df[lake_df['Date'] == last_date]
            pct_above_50 = (today_df['Close'] > today_df['SMA_50']).mean() * 100
        else:
            pct_above_50 = 50.0
            
        breadth_df = pd.DataFrame({'Pct_Above_50_SMA': [pct_above_50] * len(spy_df_full)})
        health_monitor = MarketHealthMonitor(spy_df_full, breadth_df)
        adaptive_screener = AdaptiveScreener(health_monitor)
        market_regime, dynamic_criteria = adaptive_screener.generate_dynamic_criteria()
        print(f"--- MARKET REGIME DETECTED: {market_regime} ---")
        print(f"Dynamic RS Requirement: {dynamic_criteria['min_rs_rating']:.1f}")
    except Exception as e:
        print(f"Market Regime calc failed: {e}")
        market_regime = "Moderate"
        dynamic_criteria = {'min_rs_rating': 80, 'max_base_depth': 0.25}
    
    results = {
        "relative_strength": [],
        "fresh_52w_high": [],
        "all_time_high": [],
        "ipo_avwap": [],
        "bullish_candlestick": [],
        "bearish_candlestick": [],
        "early_stage_2": [],
        "darvas_strong": [],
        "darvas_about_to": [],
        "regression_channel_breakout": [],
        "val_rejection": [],
        "val_rejection_fixed": [],
        "vah_rejection": [],
        "vah_rejection_fixed": [],
        "poc_rejection": [],
        "poc_rejection_fixed": [],
        "fvg_sma_confluence": [],
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
        "low_volume_breakout": [],
        "pending_breakout": [],
        "qullamaggie_setup": [],
        "rs_divergence": [],
        "bull_flag_breakout": [],
        "bull_flag_pending": [],
        "universal_takeout": [],
        "earnings_surge": []
    }
    
    # We will collect highly-trending candidates here and check their fundamentals in bulk at the end
    zacks_candidates = []
    
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
        
        # --- NEW AGENTS (Long Base, Medium Base, Pending Breakout, Qullamaggie) ---
        # These structural base scanners must run BEFORE the master volatility filter 
        # because a tight Medium Base (VCP) will naturally have its volatility crushed below 2.5% ADR!
        try:
            if lakehouse_mode:
                lb_res = evaluate_long_base(ticker, pre_df=ticker_df)
            else:
                lb_res = evaluate_long_base(ticker, pre_df=ticker_df)
                
            if lb_res:
                is_conf = "CONFIRMED" in lb_res['status']
                status_short = "Confirmed" if is_conf else "Coiled"
                dist = lb_res.get('distance_pct', 0.0)
                # Score: Confirmed breakouts get 100+ points, coiled get 100 - distance
                lb_score = 150.0 if is_conf else max(50.0, 100.0 - float(dist))
                results["long_base_breakout"].append({
                    "ticker": ticker, 
                    "metric": f"{status_short} | Dist: {dist}%",
                    "score": lb_score
                })
                
            mb_res = evaluate_medium_base(ticker, pre_df=ticker_df)
            if mb_res:
                status_short = "Confirmed" if "CONFIRMED" in mb_res['status'] else "Coiled"
                dur = mb_res.get('base_duration', '3M')
                results["medium_base_breakout"].append({"ticker": ticker, "metric": f"{dur} | {status_short}"})
            else:
                # If it failed the strict pocket pivot check, try catching it with a relaxed 1.0x volume check
                low_vol_res = evaluate_medium_base(ticker, pre_df=ticker_df, min_volume_multiplier=1.0)
                if low_vol_res and "CONFIRMED" in low_vol_res['status']:
                    dur = low_vol_res.get('base_duration', '3M')
                    results["low_volume_breakout"].append({"ticker": ticker, "metric": f"{dur} | Quiet Breakout (>1.0x Vol)"})
            
            pb_res = detect_pending_breakout(ticker, pre_df=ticker_df)
            if pb_res:
                results["pending_breakout"].append({"ticker": ticker, "metric": f"Pending Breakout | {pb_res['alerts'][0]['model']}"})
                
            if curr_c >= 2.0 and vol.iloc[-20:].mean() >= 100000:
                qm_res = evaluate_qullamaggie_setup(ticker, pre_df=ticker_df)
                if qm_res:
                    actual_status = qm_res.get('status', 'PENDING')
                    display_status = "Pending Breakout" if actual_status == "PENDING" else actual_status.title()
                    results["qullamaggie_setup"].append({"ticker": ticker, "metric": f"{display_status} | ADR: {qm_res['adr']} | SMA: {qm_res['sma_support']}"})
            
            # Earnings Surprise & Revisions Scanner
            earn_res = evaluate_earnings_surprise(ticker)
            if earn_res:
                up_rev = earn_res.get('upgrades_30d', 0)
                score = earn_res.get('score', 0)
                eps = earn_res.get('eps_surprise_pct', 0)
                results["earnings_surge"].append({
                    "ticker": ticker,
                    "metric": f"PEDP Score: {score}/100 | EPS: +{eps}% | Upgrades: {up_rev}"
                })
        except Exception as e:
            pass

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
                    
                    # FILTER: Prevent crashing stocks from showing up in Highest Relative Strength
                    daily_pct_change = (curr_c / close.iloc[-2]) - 1
                    if daily_pct_change > -0.05:
                        # 1. Price > 50 SMA > 200 SMA (Structural Uptrend)
                        # 2. Within 25% of 52-week high (Not a bottom bounce)
                        if curr_c > sma50 and sma50 > sma200 and curr_c >= high_52w * 0.75:
                            results["relative_strength"].append({"ticker": ticker, "metric": f"+{rs_1mo:.1f}% vs SPY", "score": float(rs_1mo)})
            
            # RS Divergence (RS line hits new 3-month high, but Price has been consolidating for >5 days)
            if len(stock_aligned) >= 63:
                rs_63d_max = rs_line.iloc[-63:].max()
                
                # Use absolute Highs to determine the true peak
                high_slice = high.iloc[-63:]
                price_63d_max = high_slice.max()
                days_since_high = 62 - high_slice.values.argmax()
                
                is_rs_high = rs_line.iloc[-1] >= (rs_63d_max * 0.97) # RS is near its high
                is_price_consolidating = days_since_high >= 5 # True intraday peak was at least 5 days ago
                is_price_diverging = curr_c < (price_63d_max * 0.99) # Price is resting at least 1% below absolute peak
                is_close_enough = curr_c >= (price_63d_max * 0.85) # Within 15% of high
                is_uptrend = curr_c > close.rolling(63).mean().iloc[-1]
                
                if is_rs_high and is_price_consolidating and is_price_diverging and is_close_enough and is_uptrend:
                    dist_to_high = ((1-(curr_c/price_63d_max))*100)
                    results["rs_divergence"].append({"ticker": ticker, "metric": f"RS New High | Price -{dist_to_high:.1f}%", "score": -float(dist_to_high)})
                    
        except Exception as e: 
            print(f"RS Error on {ticker}: {e}")
        
        # 2 & 3. 52-Week Highs & All-Time Highs
        if is_aaaa: print("Starting 52w High...")
        if len(high) >= 252:
            prev_high_52w = high.iloc[-252:-1].max()
            curr_h = high.iloc[-1]
            if curr_h >= prev_high_52w:
                results["fresh_52w_high"].append({"ticker": ticker, "metric": f"New High: ${curr_h:.2f}"})
        
        ath_4y = float(close.max())
        if curr_c >= ath_4y * 0.98:
            # Verify true All-Time High by fetching max history for this specific stock
            try:
                # Always verify true ATH over the network because the local lakehouse 
                # only holds 2-4 years of data. This prevents pandemic-era runners 
                # like SNOW ($429 true ATH) from falsely triggering on a 4-year high.
                from yahooquery import Ticker as YQTicker
                hist_max = YQTicker(ticker).history(period="max", interval="1mo")
                true_ath = float(hist_max['high'].max()) if (hist_max is not None and not hist_max.empty) else ath_4y
                
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
            
        # 4. Early Stage 2 Breakout (Requires Upward Moving Average Slopes & Alignment)
        if is_aaaa: print("Starting Early Stage 2 Breakout Check...")
        if len(close) >= 200:
            sma20 = close.rolling(20).mean()
            sma50 = close.rolling(50).mean()
            sma200 = close.rolling(200).mean()
            curr_sma = float(sma200.iloc[-1])
            curr_sma50 = float(sma50.iloc[-1])
            curr_sma20 = float(sma20.iloc[-1])
            prev_sma = float(sma200.iloc[-5])
            prev_c = float(close.iloc[-5])
            
            # Calculate moving average slopes (% change over recent periods)
            slope20 = (curr_sma20 - float(sma20.iloc[-5])) / float(sma20.iloc[-5]) * 100
            slope50 = (curr_sma50 - float(sma50.iloc[-10])) / float(sma50.iloc[-10]) * 100
            slope200 = (curr_sma - float(sma200.iloc[-20])) / float(sma200.iloc[-20]) * 100
            
            # Price crossed above 200 SMA in last 10 days
            crosses = (close > sma200) & (close.shift(1) <= sma200.shift(1))
            # Require price > 200 SMA, price > 50 SMA, AND moving average slopes moving up!
            if crosses.iloc[-10:].any() and curr_c > curr_sma and curr_c > curr_sma50:
                if slope20 > 0 and slope50 > -0.2 and slope200 >= -0.5:
                    results["early_stage_2"].append({"ticker": ticker, "metric": f"Crossed 200 SMA (${curr_sma:.2f})"})
                
        # 7. Darvas Breakout (Using Authentic Algorithmic Logic)
        try:
            db_status, db_top, db_bottom, db_msg = calculate_darvas_box(ticker_df)
            if db_status == "STRONG_BREAKOUT":
                results["darvas_strong"].append({"ticker": ticker, "metric": f"Cleared ${db_top:.2f} | {db_msg}", "score": 2.0})
            elif db_status == "ABOUT_TO_BREAKOUT":
                results["darvas_about_to"].append({"ticker": ticker, "metric": f"Tight Coil against ${db_top:.2f}", "score": 1.0})
        except Exception as e:
            pass
                
        # 8. Regression Channel Breakout
        try:
            reg_res = evaluate_regression_channel(ticker, df=ticker_df, lookback=120)
            if reg_res:
                results["regression_channel_breakout"].append({"ticker": ticker, "metric": reg_res["message"]})
        except Exception:
            pass
            
        # 9. Volume Profile Rejections (VAL, VAH, POC Pullback Tests)
        try:
            vp_res = evaluate_volume_profile_rejections(ticker, df=ticker_df, lookback=63)
            if vp_res:
                # VAL Rejections (Rolling & Fixed)
                val_data = vp_res.get("val")
                if val_data:
                    if val_data.get("rolling_message"):
                        results["val_rejection"].append({
                            "ticker": ticker, 
                            "metric": val_data["rolling_message"],
                            "score": val_data.get("score", 85.0)
                        })
                    if val_data.get("fixed_message"):
                        results["val_rejection_fixed"].append({
                            "ticker": ticker, 
                            "metric": val_data["fixed_message"],
                            "score": val_data.get("score", 85.0)
                        })
                # VAH Pullback Support Rejection (Rolling & Fixed)
                vah_data = vp_res.get("vah")
                if vah_data:
                    results["vah_rejection"].append({
                        "ticker": ticker,
                        "metric": vah_data["metric"],
                        "score": vah_data.get("score", 90.0)
                    })
                vah_f_data = vp_res.get("vah_fixed")
                if vah_f_data:
                    results["vah_rejection_fixed"].append({
                        "ticker": ticker,
                        "metric": vah_f_data["metric"],
                        "score": vah_f_data.get("score", 90.0)
                    })
                # POC Pullback Support Rejection (Rolling & Fixed)
                poc_data = vp_res.get("poc")
                if poc_data:
                    results["poc_rejection"].append({
                        "ticker": ticker,
                        "metric": poc_data["metric"],
                        "score": poc_data.get("score", 90.0)
                    })
                poc_f_data = vp_res.get("poc_fixed")
                if poc_f_data:
                    results["poc_rejection_fixed"].append({
                        "ticker": ticker,
                        "metric": poc_f_data["metric"],
                        "score": poc_f_data.get("score", 90.0)
                    })
        except Exception:
            pass
        # 9.5 FVG + SMA Confluence
        try:
            fvg_res = evaluate_fvg_sma_confluence(ticker, df=ticker_df)
            if fvg_res:
                results["fvg_sma_confluence"].append({"ticker": ticker, "metric": fvg_res["metric"]})
        except Exception:
            pass
            
        # 7.5 Breakout Retest & Squat MA Support
        if len(high) >= 70:
            # Pivot is the max high from 70 days ago up to 10 days ago (the base)
            base_highs = high.iloc[-70:-10]
            pivot = base_highs.max()
            recent_data = high.iloc[-10:-1]
            recent_high = recent_data.max()
            
            # Did we breakout recently?
            if recent_high > pivot:
                # Validate that this was a true base (spent at least 15 days of the 60-day base below the pivot line)
                days_below_pivot = (base_highs < pivot * 0.99).sum()
                is_true_base = days_below_pivot >= 15
                
                peak_idx = recent_data.values.argmax() 
                days_since_peak = len(recent_data) - peak_idx
                
                # Validate that the pullback never structurally violated the pivot (crashing heavily beneath it)
                pullback_min_low = low.iloc[-days_since_peak:].min()
                did_not_violate = pullback_min_low >= pivot * 0.96
                
                curr_l = low.iloc[-1]
                curr_h = high.iloc[-1]
                curr_c = close.iloc[-1]
                curr_o = open_s.iloc[-1]
                
                # 1. Pullback Speed & Structure
                is_orderly_pullback = 2 <= days_since_peak <= 8
                
                # Check proximity to pivot and our new structural integrity flags
                if is_true_base and did_not_violate and is_orderly_pullback and (pivot * 0.985 < curr_c <= pivot * 1.05) and (pivot * 0.97 <= curr_l <= pivot * 1.015):
                    
                    # 2. Wick Structure (Rejection Tail)
                    lower_wick = min(curr_o, curr_c) - curr_l
                    body = abs(curr_o - curr_c)
                    total_range = curr_h - curr_l
                    is_rejection = (lower_wick > body * 1.5) and (lower_wick > total_range * 0.35) if total_range > 0 else False
                    
                    # 3. Volatility Contraction
                    atr_base = (high.iloc[-70:-10] - low.iloc[-70:-10]).mean()
                    is_contracting = total_range <= atr_base * 1.2
                    
                    # 4. Volume Contraction & Breakout Conviction
                    breakout_vol = vol.iloc[-10:-days_since_peak].max() if days_since_peak < 10 else vol.iloc[-10]
                    avg_vol_50 = vol.iloc[-60:-10].mean()
                    is_conviction_breakout = breakout_vol > avg_vol_50 * 1.5
                    
                    pullback_vol = vol.iloc[-days_since_peak:].mean()
                    vol_drying_up = pullback_vol < avg_vol_50 * 1.1
                    
                    # 5. Moving Average Alignment
                    ema10 = close.ewm(span=10, adjust=False).mean().iloc[-1]
                    ma_aligned = abs(ema10 - pivot) / pivot < 0.025
                    
                    # 6. Relative Strength (RS didn't crater)
                    rs_spy_10d = ((curr_c / spy_close.iloc[-1]) / (close.iloc[-10] / spy_close.iloc[-10]) - 1) * 100 if spy_close.iloc[-10] != 0 else 0
                    rs_strong = rs_spy_10d > -2.0
                    
                    # Final A+ Condition
                    if is_contracting and vol_drying_up and is_conviction_breakout and ma_aligned and rs_strong:
                        score = float(lower_wick / total_range) if total_range > 0 else 0
                        results["breakout_retest"].append({"ticker": ticker, "metric": f"A+ Retest Pivot: ${pivot:.2f}", "score": score})
                
                # Fell into Base & Found Support on Short Term MA (10 or 20)
                sma10 = close.rolling(10).mean().iloc[-1]
                sma20 = close.rolling(20).mean().iloc[-1]
                
                # Fell back below pivot
                if curr_c < pivot:
                    # Macro uptrend prerequisite (SMA50 > SMA200 and SMA50 sloping up over 3 weeks)
                    sma50_series = close.rolling(50).mean()
                    sma50 = sma50_series.iloc[-1]
                    sma50_15d_ago = sma50_series.iloc[-15] if len(sma50_series) >= 15 else sma50
                    sma200 = close.rolling(200).mean().iloc[-1]
                    
                    is_uptrend = (sma50 > sma200) if not pd.isna(sma200) else True
                    sma50_sloping_up = (sma50 > sma50_15d_ago)
                    
                    if is_uptrend and curr_c > sma50 and sma50_sloping_up:
                        # Found support on 10 SMA (Low must touch but not violate by more than 3%)
                        if (sma10 * 0.97 <= curr_l <= sma10 * 1.01) and curr_c >= sma10 * 0.99:
                            results["base_pullback_ma"].append({"ticker": ticker, "metric": f"Squat Support at 10-SMA (${sma10:.2f})"})
                        # Found support on 20 SMA
                        elif (sma20 * 0.97 <= curr_l <= sma20 * 1.01) and curr_c >= sma20 * 0.99:
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
            
        # 9. High Volume Event (HVE) (Smart Volume Climax)
        curr_vol = vol.iloc[-1]
        
        if len(vol) >= 21:
            vol_21d_max = vol.iloc[-21:].max()
            vol_63d_max = vol.iloc[-63:].max() if len(vol) >= 63 else vol_21d_max
            vol_126d_max = vol.iloc[-126:].max() if len(vol) >= 126 else vol_63d_max
            vol_252d_max = vol.iloc[-252:].max() if len(vol) >= 252 else vol_126d_max
            vol_lifetime_max = vol.max()
            
            hve_tier = None
            if curr_vol >= vol_lifetime_max * 0.95:
                hve_tier = "Lifetime High Volume"
            elif curr_vol >= vol_252d_max * 0.95:
                hve_tier = "Yearly High Volume"
            elif curr_vol >= vol_126d_max * 0.95:
                hve_tier = "Half-Yearly High Volume"
            elif curr_vol >= vol_63d_max * 0.95:
                hve_tier = "Quarterly High Volume"
            elif curr_vol >= vol_21d_max * 0.95:
                hve_tier = "Monthly High Volume"
            
            # Must be a massive positive green day (Close > Prev Close, Close > Open, and closing near the High)
            is_bullish_day = (curr_c > prev_c) and (curr_c > curr_o) and (curr_c >= high.iloc[-1] * 0.90)
            
            if hve_tier and is_bullish_day:
                avg_vol = vol.iloc[-50:].mean() if len(vol) >= 50 else vol.mean()
                vol_mult = curr_vol / avg_vol if avg_vol > 0 else 1.0
                results["hve_volume"].append({"ticker": ticker, "metric": f"{hve_tier} ({vol_mult:.1f}x Avg)", "score": float(vol_mult)})
            
        # 10. Consolidation after Positive HVE (Smart Volume)
        positive_hve_days = []
        if len(vol) >= 63:
            for i in range(-15, -1):
                # Calculate the 63-day max volume up to the day before 'i' to see if 'i' was a climax
                hist_vol = vol.iloc[i-63:i+1] if i >= -63 else vol.iloc[:i+1]
                if len(hist_vol) > 0 and vol.iloc[i] >= hist_vol.max() * 0.95:
                    # Must be structurally positive AND gain at least 10% on the day
                    c_day = close.iloc[i]
                    o_day = open_s.iloc[i]
                    pc_day = close.iloc[i-1]
                    h_day = high.iloc[i]
                    if (c_day > pc_day) and (c_day > o_day) and (c_day >= h_day * 0.90) and (c_day >= pc_day * 1.10):
                        positive_hve_days.append(i)
                    
        if positive_hve_days:
            # Take the most recent one
            hve_idx = positive_hve_days[-1]
            hve_c = close.iloc[hve_idx]
            hve_l = low.iloc[hve_idx]
            hve_h = high.iloc[hve_idx]
            hve_mid = hve_l + ((hve_h - hve_l) * 0.5)
            
            # Since the HVE, price must consolidate in the UPPER HALF of the HVE candle (True Bull Flag)
            days_since = abs(hve_idx) - 1
            if days_since >= 3: # Need at least 3 days of consolidation
                post_hve_lows = low.iloc[hve_idx+1:]
                
                # Condition 1: Holds UPPER HALF of the HVE candle (No major breakdown)
                if post_hve_lows.min() >= hve_mid * 0.98: # Allow slight wick below midpoint
                    # Condition 2: Tight consolidation in the last 4 days
                    recent_tightness = (high.iloc[-4:].max() - low.iloc[-4:].min()) / low.iloc[-4:].min()
                    
                    # Condition 3: Volume dry up
                    avg_v = vol.iloc[-65:-15].mean()
                    if recent_tightness < 0.06 and vol.iloc[-3:].mean() < avg_v * 1.2:
                        # Score mathematically by how tight the consolidation is (lower tightness = higher score)
                        results["hve_consolidation"].append({"ticker": ticker, "metric": f"Tight Post-HVE ({days_since}d)", "score": -float(recent_tightness)})
                
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
                        gap_low = low.iloc[i]
                        flag_high = high.iloc[i+1:-1].max() if days_since > 1 else high.iloc[i]
                        
                        # 1. Strict Gap Hold: Closes and lows must hold the gap day's low
                        lowest_close_since_gap = close.iloc[i:].min()
                        lowest_low_since_gap = low.iloc[i:].min()
                        
                        # 2. Drawdown from flag high must not exceed 15%
                        flag_high_real = high.iloc[i:].max()
                        max_drawdown = (flag_high_real - lowest_low_since_gap) / flag_high_real
                        
                        is_holding_gap = lowest_close_since_gap >= gap_low * 0.98 and lowest_low_since_gap >= gap_low * 0.95
                        is_tight = max_drawdown <= 0.15
                        not_explosive = flag_high_real < day_c * 1.15
                        not_breaking_out = curr_c <= flag_high * 1.01
                        
                        if is_holding_gap and is_tight and not_explosive and not_breaking_out:
                            results["post_earning_consolidation"].append({"ticker": ticker, "metric": f"Holding Gap {days_since}d"})
                    break # Stop looking after finding the most recent one

        # 12. Cup and Handle (Weekly & Monthly)
        if is_aaaa: print("Starting Cup Handle...")
        try:
            # Resample to Weekly
            weekly_df = ticker_df.resample('W').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
            if check_cup_and_handle(weekly_df, is_monthly=False):
                results["weekly_cup_handle"].append({"ticker": ticker, "metric": "Weekly Cup & Handle"})
                
            # 12.5 Universal Takeout (Upgraded)
            if len(weekly_df) >= 3 and len(close) >= 200:
                sma200 = close.rolling(200).mean().iloc[-1]
                sma50 = close.rolling(50).mean().iloc[-1]
                
                # Context Filter: Must be in a structural Stage 2 Uptrend
                if curr_c > sma50 and sma50 > sma200:
                    low_2 = weekly_df['Low'].iloc[-3]
                    low_1 = weekly_df['Low'].iloc[-2]
                    low_0 = weekly_df['Low'].iloc[-1]
                    high_2 = weekly_df['High'].iloc[-3]
                    high_1 = weekly_df['High'].iloc[-2]
                    takeout_high = max(high_1, high_2) # Target the structural peak of the coil
                    curr_val = weekly_df['Close'].iloc[-1]
                    curr_high = weekly_df['High'].iloc[-1]
                    
                    # Wedge & Volatility Filter: The recent high (high_1) must compress under the prior peak (high_2) to form a true coil/handle.
                    # It cannot just be making massive new highs (which is an uptrend, not a coil). We allow a tiny 1.5% overshoot.
                    is_flat_top = (high_1 <= high_2 * 1.015) and (high_1 >= high_2 * 0.90)
                    
                    # Universal Condition: Sequential Higher Lows + Flat Top
                    if low_0 > low_1 and low_1 > low_2 and is_flat_top:
                        if curr_high > takeout_high:
                            # Breakout confirmation: Current daily close must HOLD above the takeout level
                            if curr_c > takeout_high:
                                # Volume Filter: Breakout must occur on >1.5x average daily volume
                                adv_50 = vol.rolling(50).mean().iloc[-1]
                                if vol.iloc[-1] >= adv_50 * 1.5:
                                    results["universal_takeout"].append({"ticker": ticker, "metric": f"Takeout Confirmed @ ${takeout_high:.2f} (Vol Surge)"})
                        else:
                            # Awaiting Takeout: Only show if within 10%
                            distance = ((takeout_high - curr_val) / takeout_high) * 100
                            if distance < 10.0:
                                results["universal_takeout"].append({"ticker": ticker, "metric": f"Coiling: {distance:.1f}% to Takeout"})
                
            # Resample to Monthly
            monthly_df = ticker_df.resample('ME').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
            if check_cup_and_handle(monthly_df, is_monthly=True):
                results["monthly_cup_handle"].append({"ticker": ticker, "metric": "Monthly Cup & Handle"})
        except Exception as e:
            pass

        # 13. Zacks Rank #1 (Strong Buy) / Fundamentals Collector
        try:
            # OPTIMIZATION: Do not fetch yf.info for 12,000 stocks inside this loop (causes rate limit crashes).
            # Instead, we identify stocks in a structural uptrend near 52w highs and bulk-query them at the end!
            if len(close) >= 200:
                sma50 = close.rolling(50).mean().iloc[-1]
                sma200 = close.rolling(200).mean().iloc[-1]
                high_52w = close.iloc[-252:].max() if len(close) >= 252 else close.max()
                
                if curr_c > sma50 and sma50 > sma200 and curr_c >= high_52w * 0.85:
                    zacks_candidates.append(ticker)
                    
            # -----------------------------------
            # -----------------------------------
            # 16. BULL FLAG BREAKOUT
            # -----------------------------------
            try:
                flag_res = detect_bull_flag(ticker, ticker_df)
                if flag_res["status"] == "triggered":
                    results["bull_flag_breakout"].append({
                        "ticker": ticker,
                        "score": flag_res["score"],
                        "pole_rally_pct": flag_res["details"]["pole_rally_pct"],
                        "flag_duration": flag_res["details"]["flag_duration"],
                        "rvol": flag_res["details"]["rvol"],
                        "metric": f"Breakout @ ${flag_res['details']['breakout_price']} (Vol {flag_res['details']['rvol']}x)"
                    })
                elif flag_res["status"] == "pending":
                    results["bull_flag_pending"].append({
                        "ticker": ticker,
                        "score": flag_res["score"],
                        "pole_rally_pct": flag_res["details"]["pole_rally_pct"],
                        "flag_duration": flag_res["details"]["flag_duration"],
                        "rvol": flag_res["details"]["rvol"],
                        "metric": f"Pending | Breakout > ${flag_res['details']['breakout_price']} (Score: {flag_res['score']})"
                    })
            except Exception as e:
                import traceback
                print(f"Bull Flag Error on {ticker}: {e}")
                traceback.print_exc()
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
    # POST-SCAN FUNDAMENTAL SWEEP (Zacks)
    # -----------------------------------
    print(f"Post-Scan Optimization: Running bulk Fundamental check on {len(zacks_candidates)} highly-trending candidates...")
    try:
        from yahooquery import Ticker as YQTicker
        if len(zacks_candidates) > 0:
            yq_zacks = YQTicker(zacks_candidates, asynchronous=True)
            z_details = yq_zacks.summary_detail
            z_fin = yq_zacks.financial_data
            z_key = yq_zacks.key_stats
            
            for t in zacks_candidates:
                d_data = z_details.get(t, {}) if isinstance(z_details, dict) else {}
                f_data = z_fin.get(t, {}) if isinstance(z_fin, dict) else {}
                k_data = z_key.get(t, {}) if isinstance(z_key, dict) else {}
                
                if isinstance(d_data, dict) and isinstance(f_data, dict) and isinstance(k_data, dict):
                    # PEG is inside key_stats!
                    peg = k_data.get('pegRatio', 999)
                    rev = f_data.get('revenueGrowth', 0)
                    rec = f_data.get('recommendationKey', 'none').lower()
                        
                    safe_peg = peg if isinstance(peg, (int, float)) else 999
                    safe_rev = rev if isinstance(rev, (int, float)) else 0
                    
                    score = 0
                    if safe_rev > 0.15: score += 2
                    elif safe_rev > 0.05: score += 1
                    elif safe_rev < 0: score -= 2
                    
                    if safe_peg < 1.0: score += 2
                    elif safe_peg <= 2.0: score += 1
                    elif safe_peg > 4.0 and safe_peg != 999: score -= 2
                    elif safe_peg > 3.0 and safe_peg != 999: score -= 1
                    elif safe_peg == 999: score -= 1
                        
                    if "buy" in rec: score += 1
                    elif "sell" in rec or "underperform" in rec: score -= 2
                    elif "hold" in rec: score -= 1
                    
                    if score >= 3:
                        results["zacks_rank_1"].append({"ticker": t, "metric": f"Score: {score} | PEG: {safe_peg}", "score": score})
    except Exception as e:
        print(f"Failed to fetch Zacks Fundamentals: {e}")
    
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
        # EXCEPT for Qullamaggie setups, which explicitly target explosive small caps
        if "qullamaggie" in key.lower():
            filtered_mcap = results[key]
        else:
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
        if results.get("darvas_strong") or results.get("darvas_about_to"):
            msg += f"📦 **Darvas Setups:**\n" + "\n".join([f"• {r['ticker']}: {r['metric']}" for r in (results.get("darvas_strong", []) + results.get("darvas_about_to", []))[:5]]) + "\n\n"
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
