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
        
        base_high = base_df['High'].max()
        base_low = base_df['Low'].min()
        
        # 1. Depth Constraint (Max 35% drawdown)
        if base_low < (base_high * 0.65):
            return None # Base is too deep, considered broken structurally
            
        # 2. Moving Average Slope Filter
        sma_200_current = base_df['SMA_200'].iloc[-1]
        sma_200_past = base_df['SMA_200'].iloc[-20]
        if current_close < sma_200_current or sma_200_current < sma_200_past:
            return None # Not in a long-term uptrend / 200 SMA is flat or declining
            
        # 3. The Coiled Spring (VCP check)
        atr_10 = base_df['ATR_10'].iloc[-1]
        atr_50 = base_df['ATR_50'].iloc[-1]
        is_coiled = atr_10 < (atr_50 * 0.5) # Short term volatility is half of long term
        
        # Add Volume Contraction verification
        adv_10 = base_df['Volume'].rolling(window=10).mean().iloc[-1]
        adv_50 = base_df['Volume'].rolling(window=50).mean().iloc[-1]
        is_vol_coiled = adv_10 < (adv_50 * 0.75)
        is_coiled = is_coiled and is_vol_coiled
        
        # Check Scenarios
        is_about_to_breakout = (current_close >= base_high * 0.90) and (current_close <= base_high) and is_coiled
        
        # User explicitly requested 150% volume surge for breakout
        is_confirmed_breakout = (current_close > base_high) and (current_volume >= base_df['ADV_50'].iloc[-1] * 1.50)
        
        if is_confirmed_breakout:
            return {
                "ticker": ticker,
                "status": "CONFIRMED BREAKOUT",
                "price": round(current_close, 2),
                "base_high": round(base_high, 2),
                "vol_surge": round((current_volume / base_df['ADV_50'].iloc[-1]) * 100, 1)
            }
        elif is_about_to_breakout:
            return {
                "ticker": ticker,
                "status": "ABOUT TO BREAKOUT (COILED)",
                "price": round(current_close, 2),
                "base_high": round(base_high, 2),
                "distance_pct": round(((base_high - current_close) / base_high) * 100, 1)
            }
            
        return None
        
    except Exception as e:
        # Silently pass errors (like delisted stocks) to keep batch running fast
        return None

def evaluate_medium_base(ticker, pre_df=None):
    """
    Evaluates if a stock is breaking out of a Medium-Term Structural Base (3 months to 2 years).
    Dynamic lookback is approx 60 to 500 trading days.
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
            
        if len(df) < 63: return None # Not enough history even for 3 months
        
        df['SMA_50'] = df['Close'].rolling(window=50).mean()
        df['SMA_200'] = df['Close'].rolling(window=200).mean()
        df['ATR_10'] = calculate_atr(df, 10)
        df['ATR_50'] = calculate_atr(df, 50)
        df['ADV_50'] = df['Volume'].rolling(window=50).mean()
        
        # Test standard structural lookbacks: 3m, 6m, 1y, 1.5y, up to max
        timeframes = [63, 126, 252, 378, 500]
        
        for lookback_target in timeframes:
            lookback = min(len(df), lookback_target)
            if lookback < 63:
                continue
                
            base_df = df.iloc[-lookback:]
            current_close = base_df['Close'].iloc[-1]
            current_volume = base_df['Volume'].iloc[-1]
            
            base_high = base_df['High'].max()
            base_low = base_df['Low'].min()
            
            # Filter out illiquid junk and SPACs that artificially appear coiled
            if base_df['Volume'].mean() < 100000 or current_close < 3.0:
                continue

            # Determine the length of the base in months
            base_length_months = round(lookback / 21)
            if base_length_months < 2: # Allow slightly shorter medium bases (2+ months)
                continue
                
            # 1. Depth Constraint (Max 40% drawdown for medium bases)
            if base_low < (base_high * 0.60):
                continue
                
            # 2. Moving Average Filter - Stock should be above 50 SMA for momentum
            sma_50_current = base_df['SMA_50'].iloc[-1]
            if current_close < sma_50_current:
                continue
                
            # 3. VCP Check (Coiled Spring)
            atr_10 = base_df['ATR_10'].iloc[-1]
            atr_50 = base_df['ATR_50'].iloc[-1]
            # Loosen coil to 75% of 50-day ATR instead of 60%
            is_coiled = atr_10 < (atr_50 * 0.75)
            
            adv_10 = base_df['Volume'].rolling(window=10).mean().iloc[-1]
            adv_50 = base_df['Volume'].rolling(window=50).mean().iloc[-1]
            # Volume contraction during the coil
            is_vol_coiled = adv_10 < (adv_50 * 0.95)
            
            is_coiled = is_coiled and is_vol_coiled
            
            # Distance checks (Within 12% of high)
            is_about_to_breakout = (current_close >= base_high * 0.88) and (current_close <= base_high) and is_coiled
            is_confirmed_breakout = (current_close > base_high) and (current_volume >= adv_50 * 1.50)
            
            if is_confirmed_breakout:
                return {
                    "ticker": ticker,
                    "status": "CONFIRMED BREAKOUT",
                    "price": round(current_close, 2),
                    "base_high": round(base_high, 2),
                    "base_duration": f"{base_length_months} Months",
                    "vol_surge": round((current_volume / adv_50) * 100, 1)
                }
            elif is_about_to_breakout:
                return {
                    "ticker": ticker,
                    "status": "ABOUT TO BREAKOUT",
                    "price": round(current_close, 2),
                    "base_high": round(base_high, 2),
                    "base_duration": f"{base_length_months} Months",
                    "distance_pct": round(((base_high - current_close) / base_high) * 100, 1)
                }
                
        return None
        
    except Exception as e:
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
