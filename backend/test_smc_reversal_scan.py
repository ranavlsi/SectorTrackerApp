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

def evaluate_advanced_divergence_reversal(df, ticker):
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
    
    # Identify swing lows for Bullish Divergence
    # Trough 1: 12 to 35 bars ago
    # Trough 2: 2 to 10 bars ago
    w1 = low.iloc[-35:-10]
    w2 = low.iloc[-10:-1]
    if len(w1) < 5 or len(w2) < 3: return None
    
    idx1 = w1.idxmin()
    idx2 = w2.idxmin()
    
    p1 = w1.min()
    p2 = w2.min()
    
    r1 = rsi.loc[idx1]
    r2 = rsi.loc[idx2]
    
    # Prerequisite: First trough was oversold/weak
    if r1 >= 40: return None
    
    # 1. Bullish Divergence condition:
    # Price makes lower low (or double bottom <= 1.01), RSI makes higher low (+3 pts)
    has_bull_div = (p2 <= p1 * 1.015) and (r2 >= r1 + 2.5)
    if not has_bull_div: return None
    
    # 2. Liquidity Grab (Turtle Soup / Stop Hunt / Sweep):
    # Did Low 2 pierce below Low 1 (taking out retail stop losses below prior low), 
    # but the daily candle CLOSED back above Low 1 (rejecting the sweep)?
    trough2_candle_close = close.loc[idx2]
    trough2_candle_low = p2
    
    # Either the trough 2 candle swept Low 1, or recent intraday low swept Low 1 and snapped back
    swept_low1 = (trough2_candle_low < p1 * 0.998) and (trough2_candle_close >= p1 * 0.99)
    recent_sweep = any(low.iloc[-5:] < p1 * 0.998) and (curr_c >= p1 * 0.99)
    has_liquidity_grab = swept_low1 or recent_sweep
    
    # 3. CHoCH (Change of Character / Market Structure Shift):
    # Swing High between the two swing lows
    mid_highs = high.loc[idx1:idx2]
    swing_high = mid_highs.max() if len(mid_highs) > 0 else (p1 * 1.05)
    
    # CHoCH confirmed if price broke above the last swing high
    has_choch = curr_c >= swing_high * 0.995 or any(close.iloc[-3:] >= swing_high)
    
    # 4. Moving Average / W-Pattern resolution
    ema10 = close.ewm(span=10, adjust=False).mean().iloc[-1]
    reclaimed_ema10 = curr_c > ema10
    
    # 5. Candlestick Confirmation
    candle_range = curr_h - curr_l
    close_in_upper = (curr_c - curr_l) >= (candle_range * 0.45) if candle_range > 0 else True
    bullish_candle = (curr_c >= curr_o * 0.995) or close_in_upper
    if not bullish_candle: return None
    
    # Must resolve into either CHoCH, Liquidity Grab + EMA10, or W-Bottom Breakout
    resolved = has_choch or (has_liquidity_grab and reclaimed_ema10) or (curr_c >= swing_high * 0.98 and reclaimed_ema10)
    if not resolved: return None
    
    # Classify pattern
    pattern_labels = []
    if has_liquidity_grab: pattern_labels.append("Liquidity Sweep")
    if has_choch: pattern_labels.append("CHoCH")
    elif reclaimed_ema10: pattern_labels.append("EMA-10 Reclaimed")
    else: pattern_labels.append("W-Bottom")
    
    pattern_str = " + ".join(pattern_labels)
    div_pts = round(r2 - r1, 1)
    
    # Score calculation
    score = 80.0 + div_pts
    if has_choch: score += 15.0
    if has_liquidity_grab: score += 10.0
    
    return {
        'ticker': ticker,
        'pattern': pattern_str,
        'div_pts': div_pts,
        'has_choch': has_choch,
        'has_liquidity_grab': has_liquidity_grab,
        'price': round(curr_c, 2),
        'score': round(score, 1),
        'metric': f"{pattern_str} | +{div_pts}pts RSI Div"
    }

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()

matches = []
for ticker, group in df.groupby('Ticker'):
    group = group.set_index('Date')
    curr_c = group['Close'].iloc[-1]
    vol = group['Volume']
    dvol = float(curr_c * vol.iloc[-20:].mean())
    if dvol < 15_000_000 or curr_c < 10: continue
    
    res = evaluate_advanced_divergence_reversal(group, ticker)
    if res:
        matches.append(res)

matches.sort(key=lambda x: x['score'], reverse=True)
print(f"Total SMC Divergence Reversal Setups Found: {len(matches)}")
for m in matches[:15]:
    print(f"  {m['ticker']}: {m['metric']} | Price=${m['price']} | Score={m['score']}")

