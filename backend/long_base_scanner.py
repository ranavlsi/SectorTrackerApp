import yfinance as yf
import pandas as pd
import numpy as np
import time

def get_sp500_tickers():
    """Fetches the S&P 500 tickers from Wikipedia."""
    import requests
    url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
    headers = {'User-Agent': 'Mozilla/5.0'}
    html = requests.get(url, headers=headers).text
    table = pd.read_html(html)[0]
    tickers = table['Symbol'].tolist()
    # Clean tickers (e.g., BRK.B to BRK-B)
    return [t.replace('.', '-') for t in tickers]

def calculate_atr(df, period):
    high_low = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close = np.abs(df['Low'] - df['Close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    return true_range.rolling(period).mean()

def evaluate_long_base(ticker, pre_df=None):
    """
    Evaluates if a stock is breaking out of a 3-Year Long Base or about to breakout.
    Uses exactly 3.5 years of weekly data.
    """
    try:
        if pre_df is not None:
            df = pre_df.copy()
        else:
            from yahooquery import Ticker as YQTicker
            t = YQTicker(ticker)
            # yahooquery history returns a multi-index dataframe (ticker, date)
            df = t.history(period="4y", interval="1d")
            if df is None or df.empty or ticker.lower() not in df.index.get_level_values(0).str.lower(): return None
            df = df.loc[ticker.lower() if ticker.lower() in df.index.levels[0] else ticker].reset_index()
            # Ensure column capitalization matches yfinance output for the rest of the script
            df.rename(columns={'close':'Close', 'high':'High', 'low':'Low', 'open':'Open', 'volume':'Volume'}, inplace=True)
            
        if len(df) < 400: return None # Need at least 1.5 years of history
        
        # Calculate Moving Averages and ATR
        df['SMA_200'] = df['Close'].rolling(window=200).mean()
        df['ATR_10'] = calculate_atr(df, 10)
        df['ATR_50'] = calculate_atr(df, 50)
        df['ADV_50'] = df['Volume'].rolling(window=50).mean()
        
        # We look at the maximum available up to 750 days
        lookback = min(len(df), 750)
        base_df = df.iloc[-lookback:]
        current_close = base_df['Close'].iloc[-1]
        current_volume = base_df['Volume'].iloc[-1]
        
        # Calculate base_high excluding the last 5 days so the current breakout isn't counted as the base roof
        historical_base = base_df.iloc[:-5]
        base_high = historical_base['High'].max()
        base_low = base_df['Low'].min()
        
        # Require the base high to have occurred at least 1 year ago (252 trading days)
        base_high_idx = historical_base['High'].idxmax()
        # Handle index get_loc safely if duplicate max values exist
        try:
            pos = historical_base.index.get_loc(base_high_idx)
            if isinstance(pos, slice) or isinstance(pos, np.ndarray):
                pos = pos[0] if isinstance(pos, np.ndarray) else pos.start
        except KeyError:
            return None
            
        days_since_high = len(historical_base) - pos
        if days_since_high < 252:
            return None # The peak was too recent; this is not a multi-year structural base
            
        # 1. Depth Constraint (Allow up to 45% drawdown for 2-3 year bases)
        if base_low < (base_high * 0.55):
            return None # Base is too deep (>45% drawdown), considered broken structurally
            
        # 2. Moving Average Slope Filter (Stock must be above 200 SMA and 200 SMA cannot be in steep downtrend)
        sma_200_current = base_df['SMA_200'].iloc[-1]
        sma_200_past = base_df['SMA_200'].iloc[-20]
        if current_close < sma_200_current or sma_200_current < sma_200_past * 0.98:
            return None # Not above 200 SMA or 200 SMA is declining significantly
            
        # 3. Volatility & Volume Coiling (Realistic VCP check near multi-year high)
        atr_10 = base_df['ATR_10'].iloc[-1]
        atr_50 = base_df['ATR_50'].iloc[-1]
        # ATR contraction: short-term ATR <= 85% of 50-day ATR or tight range < 8% over last 10 days
        recent_10_high = base_df['High'].iloc[-10:].max()
        recent_10_low = base_df['Low'].iloc[-10:].min()
        is_tight_range = (recent_10_high - recent_10_low) / current_close <= 0.08
        is_atr_coiled = atr_10 <= (atr_50 * 0.85) if (atr_50 and atr_50 > 0) else False
        is_coiled = is_tight_range or is_atr_coiled
        
        # Volume Contraction: 10-day volume <= 50-day average volume
        adv_10 = base_df['Volume'].rolling(window=10).mean().iloc[-1]
        adv_50 = base_df['Volume'].rolling(window=50).mean().iloc[-1]
        is_vol_coiled = adv_10 <= (adv_50 * 1.05) if (adv_50 and adv_50 > 0) else True
        is_coiled = is_coiled and is_vol_coiled
        
        # Check Scenarios
        # Scenario A: Coiling within 10% of 3-year pivot (About to breakout)
        dist_from_high_pct = round(((base_high - current_close) / base_high) * 100, 1)
        is_about_to_breakout = (current_close >= base_high * 0.90) and (current_close <= base_high * 1.01) and is_coiled
        
        # Scenario B: Confirmed Breakout (closing at new 3-year high or broke out in the last 5 days with volume conviction)
        recent_5_high = base_df['High'].iloc[-5:].max()
        has_broken_out = current_close > base_high or recent_5_high > base_high
        is_confirmed_breakout = has_broken_out and (current_volume >= adv_50 * 1.20 or adv_10 >= adv_50 * 1.10)
        
        if is_confirmed_breakout:
            vol_ratio = round((current_volume / adv_50) * 100, 1) if (adv_50 and adv_50 > 0) else 100.0
            return {
                "ticker": ticker,
                "status": "CONFIRMED BREAKOUT",
                "price": round(current_close, 2),
                "base_high": round(base_high, 2),
                "vol_surge": vol_ratio,
                "distance_pct": 0.0
            }
        elif is_about_to_breakout:
            return {
                "ticker": ticker,
                "status": "ABOUT TO BREAKOUT (COILED)",
                "price": round(current_close, 2),
                "base_high": round(base_high, 2),
                "distance_pct": max(0.0, dist_from_high_pct)
            }
            
        return None
        
    except Exception as e:
        # Silently pass errors (like delisted stocks) to keep batch running fast
        return None

def evaluate_medium_base(ticker, pre_df=None, min_volume_multiplier=None):
    """
    Evaluates if a stock is breaking out of a Medium-Term Structural Base (3 months to 2 years).
    Upgraded with Dynamic Depth, Minervini Trend Template, and VCP/Pocket Pivot Triggers.
    Optionally accepts min_volume_multiplier to allow relaxed low-volume breakout scans.
    """
    try:
        if pre_df is not None:
            df = pre_df.copy()
        else:
            from yahooquery import Ticker as YQTicker
            t = YQTicker(ticker)
            df = t.history(period="2y", interval="1d")
            if df is None or df.empty or ticker.lower() not in df.index.get_level_values(0).str.lower(): return None
            df = df.loc[ticker.lower() if ticker.lower() in df.index.levels[0] else ticker].reset_index()
            df.rename(columns={'close':'Close', 'high':'High', 'low':'Low', 'open':'Open', 'volume':'Volume'}, inplace=True)
            
        if len(df) < 250: return None # Need enough data for 200 SMA + 21 days back
        
        # Calculate moving averages
        df['SMA_50'] = df['Close'].rolling(window=50).mean()
        df['SMA_200'] = df['Close'].rolling(window=200).mean()
        df['ATR_10'] = calculate_atr(df, 10)
        df['ATR_50'] = calculate_atr(df, 50)
        df['ADV_50'] = df['Volume'].rolling(window=50).mean()
        
        # 0. Basic Clean
        df['Close'] = df['Close'].ffill()

        # 1. Minervini Trend Template Filter (Must be checked on the current day)
        current_close = df['Close'].iloc[-1]
        sma_50_current = df['SMA_50'].iloc[-1]
        sma_200_current = df['SMA_200'].iloc[-1]
        sma_200_21d_ago = df['SMA_200'].iloc[-22]
        
        if current_close < sma_50_current or current_close < sma_200_current:
            return None
        if sma_50_current < sma_200_current:
            return None
        if sma_200_current < sma_200_21d_ago:
            return None # Macro trend is not rising

        # Test standard structural lookbacks: 3m, 6m, 1y, 1.5y, up to max
        timeframes = [63, 126, 252, 378, 500]
        
        for lookback_target in timeframes:
            lookback = min(len(df), lookback_target)
            if lookback < 63:
                continue
                
            base_df = df.iloc[-lookback:].copy()
            current_volume = base_df['Volume'].iloc[-1]
            
            base_high = base_df['High'].max()
            base_low = base_df['Low'].min()
            
            if base_df['Volume'].mean() < 100000 or current_close < 3.0:
                continue

            # 1.5 Proper Base Structure (High cannot be just a recent 2-week pullback)
            base_high_idx = base_df['High'].idxmax()
            pos = base_df.index.get_loc(base_high_idx)
            days_since_high = len(base_df) - pos
            
            if days_since_high < max(21, int(lookback * 0.33)):
                continue # The left side of the cup is too recent, this is not a true base
                
            actual_base_length_months = max(2, round(days_since_high / 21))
                
            # 2. Dynamic Base Depth
            base_drawdown = (base_high - base_low) / base_high
            max_allowed_drawdown = 0.30 if actual_base_length_months < 6 else 0.40
            if base_drawdown > max_allowed_drawdown:
                continue
                
            # 3. Right Side VCP Compression
            base_range = base_high - base_low
            right_side_range = base_df['High'].iloc[-10:].max() - base_df['Low'].iloc[-10:].min()
            if base_range > 0 and (right_side_range / base_range) >= 0.40:
                continue # The right side is too loose

            # 4. Absolute Dry-Up
            last_10_days = base_df.iloc[-10:]
            days_under_75pct_vol = (last_10_days['Volume'] < (0.75 * last_10_days['ADV_50'])).sum()
            if days_under_75pct_vol < 2:
                continue # No absolute true dry-up detected

            # 5. U/D Accumulation Ratio
            last_50_days = base_df.iloc[-50:]
            up_days_vol = last_50_days[last_50_days['Close'] > last_50_days['Open']]['Volume'].sum()
            down_days_vol = last_50_days[last_50_days['Close'] < last_50_days['Open']]['Volume'].sum()
            
            if down_days_vol == 0:
                ud_ratio = 999.0
            else:
                ud_ratio = up_days_vol / down_days_vol
                
            if ud_ratio < 1.05:
                continue # Distribution is too high

            # 6. Breakout Trigger (15-Day Handle Pivot + Pocket Pivot)
            # Use iloc[-16:-1] to get the 15 days *before* today
            handle_high_15 = base_df['High'].iloc[-16:-1].max()
            
            # Pocket Pivot Volume Logic
            # Down days volume in the last 10 days
            last_10_prev = base_df.iloc[-11:-1]
            down_days_10 = last_10_prev[(last_10_prev['Close'] < last_10_prev['Open']) | 
                                        (last_10_prev['Close'] < last_10_prev['Close'].shift(1))]
            max_down_vol_10 = down_days_10['Volume'].max() if not down_days_10.empty else 0
            
            is_up_day = (current_close > base_df['Open'].iloc[-1]) and (current_close > base_df['Close'].iloc[-2])
            is_pocket_pivot = is_up_day and (current_volume > max_down_vol_10)

            # Optional custom volume multiplier fallback (for catching stealthy low-volume breakouts)
            if min_volume_multiplier is not None:
                has_sufficient_vol = current_volume > (base_df['ADV_50'].iloc[-1] * min_volume_multiplier)
                is_valid_breakout_vol = is_pocket_pivot or has_sufficient_vol
            else:
                is_valid_breakout_vol = is_pocket_pivot

            # Check proximity to the main base pivot
            is_about_to_breakout = (current_close >= base_high * 0.85) and (current_close <= base_high)
            is_confirmed_breakout = (current_close > base_high) and is_valid_breakout_vol

            
            if is_confirmed_breakout:
                return {
                    "ticker": ticker,
                    "status": "CONFIRMED BREAKOUT",
                    "price": round(current_close, 2),
                    "base_high": round(base_high, 2), # Keep for context
                    "handle_pivot": round(handle_high_15, 2),
                    "base_duration": f"{actual_base_length_months} Months",
                    "vol_surge": round((current_volume / base_df['ADV_50'].iloc[-1]) * 100, 1),
                    "ud_ratio": round(ud_ratio, 2)
                }
            elif is_about_to_breakout:
                return {
                    "ticker": ticker,
                    "status": "ABOUT TO BREAKOUT",
                    "price": round(current_close, 2),
                    "base_high": round(base_high, 2),
                    "handle_pivot": round(handle_high_15, 2),
                    "base_duration": f"{actual_base_length_months} Months",
                    "distance_pct": round(((base_high - current_close) / base_high) * 100, 1),
                    "ud_ratio": round(ud_ratio, 2)
                }
                
        return None
        
    except Exception as e:
        print(f"[Medium Base Engine] Error analyzing {ticker}: {e}")
        return None

def run_saturday_batch_scan():
    print("[Long Base Scanner] Waking up. Fetching S&P 500 universe...")
    tickers = get_sp500_tickers()
    
    # We will test on a subset if doing this live, but let's scan all in production
    results = []
    
    print(f"[Long Base Scanner] Analyzing {len(tickers)} stocks for multi-year structural bases...")
    for i, ticker in enumerate(tickers):
        # Print progress every 50 stocks
        if i > 0 and i % 50 == 0:
            print(f"Scanned {i}/{len(tickers)}...")
            
        res = evaluate_long_base(ticker)
        if res:
            results.append(res)
            
    # Format Alert
    if not results:
        msg = "🗓️ Weekly 3-Year Base Scan Complete: No setups found matching strict criteria."
    else:
        msg = "🏗️ **WEEKLY 3-YEAR BASE REPORT** 🏗️\n\n"
        for r in results:
            if r['status'] == "CONFIRMED BREAKOUT":
                msg += f"🔥 **{r['ticker']}** CONFIRMED Stage 2 Transition!\n"
                msg += f"   Price: ${r['price']} (Cleared 3-Year Roof of ${r['base_high']})\n"
                msg += f"   Volume: {r['vol_surge']}% of average\n\n"
            else:
                msg += f"⏳ **{r['ticker']}** ABOUT TO BREAKOUT (Coiled)\n"
                msg += f"   Price: ${r['price']} (Only {r['distance_pct']}% below 3-Year Roof of ${r['base_high']})\n"
                msg += f"   VCP: Tight volatility contraction detected.\n\n"
                
    print("\n[Long Base Scanner] Final Report Generated:")
    print(msg)
    
    # Normally we would send via telegram: broadcast_telegram_alert("MACRO", msg)
    # For now, let's write to a json file to integrate if needed
    import json
    import os
    report_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'long_base_report.json')
    with open(report_path, 'w') as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    # In production, this file should be executed by a CRON job or task scheduler every Saturday.
    # We'll run a mini test over 10 stocks just to prove it works.
    test_tickers = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'TSLA', 'BRK-B', 'LLY', 'AVGO', 'JPM']
    
    print("[Long Base Scanner - TEST RUN]")
    results = []
    for ticker in test_tickers:
        res = evaluate_long_base(ticker)
        if res:
            results.append(res)
            
    print(results)
    
    # If the user runs the full script manually, it will do all 500
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == '--full':
        run_saturday_batch_scan()
