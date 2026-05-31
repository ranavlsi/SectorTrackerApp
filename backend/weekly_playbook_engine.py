import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
import sys
from datetime import datetime

# Import TradeCouncil and UNIVERSE
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    from trade_council import TradeCouncil
except ImportError:
    print("Error importing TradeCouncil.")
    sys.exit(1)

try:
    from screener_engine import UNIVERSE
except ImportError:
    UNIVERSE = ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ADBE', 'META', 'GOOGL', 'AMZN', 'TSLA']
    
try:
    from sector_data_api import calculate_stage, calculate_macd, calculate_rsi, calculate_momentum_fade
except ImportError:
    print("Warning: Could not import health functions from sector_data_api")
    def calculate_stage(c,s): return "Unknown"
    def calculate_macd(c): return pd.Series(0), pd.Series(0)
    def calculate_rsi(c): return pd.Series(0)
    def calculate_momentum_fade(m,s,r): return "Unknown", "#94a3b8"

OUTPUT_FILE = "/Users/amitkumar/Desktop/SectorTrackerApp/public/weekly_playbook.json"

def calculate_squeeze(df):
    """Returns True if Bollinger Bands are inside Keltner Channels (TTM Squeeze)."""
    # 20 SMA
    df['SMA20'] = df['Close'].rolling(window=20).mean()
    # Bollinger Bands (20, 2)
    std = df['Close'].rolling(window=20).std()
    df['BB_up'] = df['SMA20'] + (std * 2)
    df['BB_down'] = df['SMA20'] - (std * 2)
    # Keltner Channels (20, 1.5 ATR)
    df['TR'] = np.maximum(df['High'] - df['Low'], 
                          np.maximum(abs(df['High'] - df['Close'].shift(1)), 
                                     abs(df['Low'] - df['Close'].shift(1))))
    df['ATR'] = df['TR'].rolling(window=20).mean()
    df['KC_up'] = df['SMA20'] + (df['ATR'] * 1.5)
    df['KC_down'] = df['SMA20'] - (df['ATR'] * 1.5)
    
    # Squeeze is ON if BBs are completely inside KCs
    squeeze_on = (df['BB_up'] < df['KC_up']) & (df['BB_down'] > df['KC_down'])
    return bool(squeeze_on.iloc[-5:].any()) # Check if squeeze fired in the last 5 days

def generate_weekly_playbook():
    print(f"Generating Weekly Playbook for {len(UNIVERSE)} stocks...")
    
    tickers = list(set(UNIVERSE))
    
    # Fetch 1 year of daily data from the Lakehouse Parquet
    print("Loading historical data from local Lakehouse database...")
    import duckdb
    lakehouse_path = "/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet"
    if not os.path.exists(lakehouse_path):
        print("Lakehouse data not found. Please run db_updater.py")
        return
        
    lake_df = duckdb.query(f"SELECT * FROM read_parquet('{lakehouse_path}') WHERE Date >= current_date() - interval '1 year' ORDER BY Date").to_df()
    grouped = lake_df.groupby('Ticker')
    
    if 'SPY' not in grouped.groups:
        print("SPY data missing from Lakehouse.")
        return
        
    spy_df = grouped.get_group('SPY').set_index('Date')
        
    spy_close = spy_df['Close'].iloc[-1]
    spy_5d_ret = (spy_close - spy_df['Close'].iloc[-6]) / spy_df['Close'].iloc[-6] * 100
    spy_50sma = spy_df['Close'].rolling(50).mean().iloc[-1]
    
    market_summary = {
        "text": f"The S&P 500 closed the week at ${spy_close:.2f}, moving {spy_5d_ret:+.2f}% over the last 5 days. Structurally, the market remains {'bullish above its 50-day moving average' if spy_close > spy_50sma else 'defensive below its 50-day moving average'}. Focus on high relative strength leaders that survived the week.",
        "bias": "Bullish" if spy_close > spy_50sma else "Bearish",
        "spy_weekly_return": f"{spy_5d_ret:+.2f}%"
    }

    # Analyze Universe
    results = []
    for ticker in tickers:
        try:
            if ticker not in grouped.groups: continue
            df = grouped.get_group(ticker).set_index('Date').dropna()
            if len(df) < 60: continue
            
            close = df['Close'].iloc[-1]
            high_52w = df['High'].max() # 1y of data downloaded, so max() is the 52w high
            sma50 = df['Close'].rolling(50).mean().iloc[-1]
            sma200 = df['Close'].rolling(200).mean().iloc[-1]
            
            # Weekly (5-day) return
            return_5d = (close - df['Close'].iloc[-6]) / df['Close'].iloc[-6] * 100
            
            # Distance from 52-week high
            dist_52w = ((high_52w - close) / high_52w) * 100
            
            # Structural trend
            uptrend = (close > sma50) and (sma50 > sma200)
            
            # Volatility Squeeze
            is_squeezing = calculate_squeeze(df.copy())
            
            results.append({
                "ticker": ticker,
                "close": close,
                "return_5d": return_5d,
                "dist_52w": dist_52w,
                "uptrend": uptrend,
                "is_squeezing": is_squeezing,
                "df": df # Save for TradeCouncil later
            })
        except Exception as e:
            continue

    # Find "Stocks That Ran" (Top 5-day gainers in an uptrend)
    uptrend_stocks = [r for r in results if r['uptrend'] and r['close'] >= 10.0]
    stocks_that_ran = sorted(uptrend_stocks, key=lambda x: x['return_5d'], reverse=True)[:5]
    
    ran_payload = []
    for s in stocks_that_ran:
        ran_payload.append({
            "ticker": s['ticker'],
            "return": f"{s['return_5d']:+.2f}%",
            "price": f"${s['close']:.2f}",
            "reason": "Extreme momentum influx; watch for exhaustion or high-tight flag formation."
        })

    # Find "About to Fly" (Tight Squeeze near 52w high)
    squeezing_stocks = [r for r in uptrend_stocks if r['is_squeezing'] and r['dist_52w'] <= 25.0]
    stocks_to_fly = sorted(squeezing_stocks, key=lambda x: x['dist_52w'])[:10] # Top 10 closest to ATH
    
    fly_payload = []
    for s in stocks_to_fly[:5]: # Send top 5 to UI array
        fly_payload.append({
            "ticker": s['ticker'],
            "price": f"${s['close']:.2f}",
            "dist_ath": f"{s['dist_52w']:.1f}%",
            "reason": "Extreme volatility compression (Bollinger Bands inside Keltner Channels) near 52-week highs."
        })

    # Select Top 3 Picks (From the Squeezing/Uptrend list)
    # If not enough squeezing, fallback to top momentum stocks.
    pool = stocks_to_fly if len(stocks_to_fly) >= 3 else (stocks_to_fly + stocks_that_ran)
    
    top_3_payload = []
    selected_tickers = set()
    
    print("Evaluating Top 3 Picks via TradeCouncil...")
    for s in pool:
        if len(top_3_payload) >= 3:
            break
        if s['ticker'] in selected_tickers:
            continue
            
        try:
            # Delegate strictly to Quantitative Trade Council
            plan = TradeCouncil.evaluate(s['ticker'], s['df'])
            
            # Calculate Technical Health Card metrics
            close = s['df']['Close']
            sma200 = close.rolling(200).mean()
            macd, signal = calculate_macd(close)
            rsi = calculate_rsi(close)
            stage = calculate_stage(close, sma200)
            mom_text, mom_color = calculate_momentum_fade(macd, signal, rsi)
            
            health = {
                "stage": stage,
                "momentum_text": mom_text,
                "momentum_color": mom_color,
                "rsi": round(float(rsi.iloc[-1]), 1) if not rsi.empty else 50.0
            }
            
            # Dynamic reasoning based on the mathematically generated setup_type
            if "Breakout" in plan['setup_type']:
                reasoning = f"Composite Breakout Logic triggered. The 15-day pivot is primed. Ensure entry does not exceed the O'Neil 5% max chase filter."
            elif "Pullback" in plan['setup_type']:
                reasoning = f"Stock is structurally extended. Wait for the Deep Value Box convergence of the 21 EMA, Anchored VWAP, and Fibonacci retracement layers."
            else:
                reasoning = f"Resting at dynamic support. Buy the dip at the nearest EMA or VWAP level."
                
            top_3_payload.append({
                "ticker": s['ticker'],
                "entry_price": f"${plan['entry_str']}",
                "stop_loss": f"${plan['stop_loss']:.2f}",
                "profit_target": f"${plan['profit_target']:.2f}",
                "setup_type": plan['setup_type'],
                "reasoning": reasoning,
                "health": health
            })
            selected_tickers.add(s['ticker'])
        except Exception as e:
            print(f"Error evaluating {s['ticker']}: {e}")
            continue

    # Final Payload Assembly
    date_str = datetime.now().strftime("%B %d, %Y")
    
    final_json = {
        "date": date_str,
        "market_summary": market_summary,
        "stocks_that_ran": ran_payload,
        "about_to_fly": fly_payload,
        "top_3_picks": top_3_payload
    }
    
    with open(OUTPUT_FILE, "w") as f:
        json.dump(final_json, f, indent=4)
        
    print(f"Successfully generated Weekly Playbook at {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_weekly_playbook()
