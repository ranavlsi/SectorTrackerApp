import numpy as np
import pandas as pd

def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).ewm(alpha=1/period, adjust=False).mean()
    loss = (-delta.where(delta < 0, 0)).ewm(alpha=1/period, adjust=False).mean()
    rs = gain / loss.replace(0, 1e-10)
    return 100 - (100 / (1 + rs))

def evaluate_divergence_reversal(ticker, df=None):
    """
    SMC Reversal Engine:
    Detects Bullish RSI Divergence that has resolved with:
    1. Liquidity Grab (Turtle Soup / Stop Hunt / Sweep of Prior Low)
    2. CHoCH (Change of Character / Break of Swing High Neckline)
    3. Structural EMA-10 / W-Bottom breakout with bullish candlestick confirmation.
    """
    try:
        if df is None or len(df) < 45:
            return None
            
        close = df['Close']
        low = df['Low']
        high = df['High']
        open_s = df['Open']
        vol = df['Volume']
        
        rsi = calculate_rsi(close, 14)
        if rsi.empty or len(rsi) < 40:
            return None
            
        curr_c = close.iloc[-1]
        curr_o = open_s.iloc[-1]
        curr_l = low.iloc[-1]
        curr_h = high.iloc[-1]
        
        # Lookback windows for swing troughs:
        # Trough 1: 12 to 35 bars ago (initial flush into oversold territory)
        # Trough 2: 2 to 10 bars ago (secondary test / stop run)
        w1 = low.iloc[-35:-10]
        w2 = low.iloc[-10:-1]
        if len(w1) < 5 or len(w2) < 3:
            return None
            
        idx1 = w1.idxmin()
        idx2 = w2.idxmin()
        
        p1 = float(w1.min())
        p2 = float(w2.min())
        
        r1 = float(rsi.loc[idx1])
        r2 = float(rsi.loc[idx2])
        
        # 1. Prerequisite: First trough occurred in oversold/washout territory
        if r1 >= 40.0:
            return None
            
        # 2. Bullish Momentum Divergence:
        # Price forms an equal or lower low (P2 <= P1 * 1.015), while RSI prints a clearly higher low (+2.5 pts)
        has_bull_div = (p2 <= p1 * 1.015) and (r2 >= r1 + 2.5)
        if not has_bull_div:
            return None
            
        # 3. Liquidity Grab (Stop Hunt / Sweep):
        # Trough 2 pierced below Trough 1 (sweeping retail stop losses below prior pivot low),
        # but the daily close held back at/above Trough 1, rejecting the breakdown.
        trough2_close = float(close.loc[idx2])
        swept_trough1 = (p2 < p1 * 0.998) and (trough2_close >= p1 * 0.99)
        recent_sweep = any(low.iloc[-5:] < p1 * 0.998) and (curr_c >= p1 * 0.99)
        has_liquidity_grab = swept_trough1 or recent_sweep
        
        # 4. CHoCH (Change of Character / Market Structure Shift):
        # The swing high / neckline between the two troughs
        mid_highs = high.loc[idx1:idx2]
        swing_high = float(mid_highs.max()) if len(mid_highs) > 0 else (p1 * 1.05)
        
        # CHoCH is confirmed when price breaches the prior swing high / structural roof
        has_choch = (curr_c >= swing_high * 0.995) or any(close.iloc[-3:] >= swing_high)
        
        # 5. Short-term Trendline / 10-EMA Reclamation:
        ema10 = float(close.ewm(span=10, adjust=False).mean().iloc[-1])
        reclaimed_ema10 = curr_c > ema10
        
        # 6. Candlestick Confirmation:
        # Green day or close in the upper 45% of today's range
        candle_range = curr_h - curr_l
        close_in_upper = ((curr_c - curr_l) >= (candle_range * 0.45)) if candle_range > 0 else True
        bullish_candle = (curr_c >= curr_o * 0.995) or close_in_upper
        if not bullish_candle:
            return None
            
        # The divergence MUST be resolved by either CHoCH, Liquidity Grab + EMA10, or W-Bottom Breakout
        is_resolved = has_choch or (has_liquidity_grab and reclaimed_ema10) or (curr_c >= swing_high * 0.98 and reclaimed_ema10)
        if not is_resolved:
            return None
            
        pattern_labels = []
        if has_liquidity_grab:
            pattern_labels.append("Liquidity Grab")
        if has_choch:
            pattern_labels.append("CHoCH")
        elif reclaimed_ema10:
            pattern_labels.append("EMA-10 Reclaimed")
        else:
            pattern_labels.append("W-Bottom")
            
        pattern_str = " + ".join(pattern_labels)
        div_pts = round(r2 - r1, 1)
        
        # Quantitative Scoring:
        # Base 80 + RSI divergence spread + bonuses for CHoCH (+15) and Liquidity Grab (+10)
        score = 80.0 + div_pts
        if has_choch:
            score += 15.0
        if has_liquidity_grab:
            score += 10.0
            
        return {
            "ticker": ticker,
            "pattern": pattern_str,
            "div_pts": div_pts,
            "has_choch": has_choch,
            "has_liquidity_grab": has_liquidity_grab,
            "price": round(float(curr_c), 2),
            "score": round(float(score), 1),
            "metric": f"{pattern_str} | +{div_pts}pts RSI Div"
        }
    except Exception:
        return None
