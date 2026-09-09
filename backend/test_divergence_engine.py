import sys
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
import duckdb
import pandas as pd
import numpy as np

def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).ewm(alpha=1/period, adjust=False).mean()
    loss = (-delta.where(delta < 0, 0)).ewm(alpha=1/period, adjust=False).mean()
    rs = gain / loss.replace(0, 1e-10)
    return 100 - (100 / (1 + rs))

def evaluate_bullish_divergence_resolution(df, ticker):
    if len(df) < 50: return None
    
    close = df['Close']
    low = df['Low']
    high = df['High']
    open_s = df['Open']
    vol = df['Volume']
    
    rsi = calculate_rsi(close, 14)
    if rsi.empty or len(rsi) < 40: return None
    
    curr_c = close.iloc[-1]
    curr_o = open_s.iloc[-1]
    curr_l = low.iloc[-1]
    curr_h = high.iloc[-1]
    
    # 1. Find the two swing lows of price over the last 15 to 35 trading days
    # Low 1 (First trough, 12-35 days ago)
    # Low 2 (Second trough, 2-10 days ago)
    # Price prints a Lower Low (or equal double bottom)
    # RSI prints a clearly Higher Low (Bullish Divergence)
    
    window_first = low.iloc[-35:-10]
    window_second = low.iloc[-10:-1]
    
    if len(window_first) < 5 or len(window_second) < 3: return None
    
    idx1 = window_first.idxmin()
    idx2 = window_second.idxmin()
    
    price_low1 = window_first.min()
    price_low2 = window_second.min()
    
    rsi_low1 = rsi.loc[idx1]
    rsi_low2 = rsi.loc[idx2]
    
    # Prerequisite: First low occurred in oversold/weak territory (RSI < 38)
    if rsi_low1 >= 38: return None
    
    # Bullish Divergence Condition:
    # Price Low 2 <= Price Low 1 * 1.01 (Lower low or double bottom)
    # RSI Low 2 >= RSI Low 1 + 3.0 (Significant momentum higher low)
    has_bullish_div = (price_low2 <= price_low1 * 1.01) and (rsi_low2 >= rsi_low1 + 3.0)
    if not has_bullish_div: return None
    
    # 2. Divergence Resolution & Bullish Pattern Trigger:
    # Intermediate peak between the two troughs (the neckline / minor pivot)
    mid_window = high.loc[idx1:idx2]
    neckline = mid_window.max() if len(mid_window) > 0 else (price_low1 * 1.05)
    
    # Trigger criteria (Resolution):
    # A) W-Bottom / Double Bottom breakout: Current close > Neckline
    # OR B) Breakout of descending trendline / 10-EMA reclamation: Close > EMA10 on expanding volume
    ema10 = close.ewm(span=10, adjust=False).mean()
    reclaimed_ema10 = (curr_c > ema10.iloc[-1]) and (close.iloc[-2] <= ema10.iloc[-2] or curr_c > ema10.iloc[-1] * 1.01)
    
    neckline_breakout = curr_c >= neckline * 0.99
    
    # Candlestick pattern today: Green day or bottom wick reversal
    candle_range = curr_h - curr_l
    close_in_upper = (curr_c - curr_l) >= (candle_range * 0.50) if candle_range > 0 else True
    bullish_candle = (curr_c >= curr_o) and close_in_upper
    
    if (neckline_breakout or reclaimed_ema10) and bullish_candle:
        pattern_name = "W-Bottom Breakout" if neckline_breakout else "EMA-10 Reclamation"
        div_spread = rsi_low2 - rsi_low1
        return {
            'ticker': ticker,
            'pattern': pattern_name,
            'price_l1': round(price_low1, 2),
            'price_l2': round(price_low2, 2),
            'rsi_l1': round(rsi_low1, 1),
            'rsi_l2': round(rsi_low2, 1),
            'spread': round(div_spread, 1),
            'neckline': round(neckline, 2),
            'price': round(curr_c, 2)
        }
    return None

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()

matches = []
for ticker, group in df.groupby('Ticker'):
    group = group.set_index('Date')
    curr_c = group['Close'].iloc[-1]
    vol = group['Volume']
    dvol = float(curr_c * vol.iloc[-20:].mean())
    if dvol < 15_000_000 or curr_c < 10: continue
    
    res = evaluate_bullish_divergence_resolution(group, ticker)
    if res:
        matches.append((res, dvol))

matches.sort(key=lambda x: x[0]['spread'], reverse=True)
print(f"Total Bullish Divergence Resolutions Found: {len(matches)}")
for m, dvol in matches[:12]:
    print(f"  {m['ticker']}: {m['pattern']} | P1=${m['price_l1']} -> P2=${m['price_l2']} | RSI1={m['rsi_l1']} -> RSI2={m['rsi_l2']} (+{m['spread']}pts) | Price=${m['price']}")
