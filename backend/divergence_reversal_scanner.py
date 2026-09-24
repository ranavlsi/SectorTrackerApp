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
    SMC Institutional Reversal Engine:
    Detects two high-conviction macro reversal anchors:
    1. Bullish RSI Divergence (momentum exhaustion / accumulation)
    2. 200-Weekly SMA Touch from Upside (institutional line-in-the-sand defense)
    
    Both must resolve with SMC Structural Confirmations:
    - Liquidity Grab (Turtle Soup / Stop Hunt / Sweep of Prior Low or 200W-SMA)
    - CHoCH (Change of Character / Break of Swing High) OR EMA-10 Reclamation
    - Bullish Candlestick Rejection & Defense
    """
    try:
        if df is None or len(df) < 45:
            return None
            
        close = df['Close']
        low = df['Low']
        high = df['High']
        open_s = df['Open']
        vol = df['Volume']
        
        curr_c = float(close.iloc[-1])
        curr_o = float(open_s.iloc[-1])
        curr_l = float(low.iloc[-1])
        curr_h = float(high.iloc[-1])
        
        # ---------------------------------------------------------
        # Branch 1: 200-Weekly SMA Institutional Touch from Upside
        # ---------------------------------------------------------
        has_200w_touch = False
        sma200_w = None
        swept_200w = False
        
        try:
            if len(df) >= 700:
                df_copy = df.copy()
                if not isinstance(df_copy.index, pd.DatetimeIndex):
                    df_copy.index = pd.to_datetime(df_copy.index)
                    
                df_weekly = df_copy[['High', 'Low', 'Close']].resample('W-FRI').agg({
                    'High': 'max',
                    'Low': 'min',
                    'Close': 'last'
                }).dropna()
                
                if len(df_weekly) >= 200:
                    weekly_close = df_weekly['Close']
                    sma200_series = weekly_close.rolling(200).mean()
                    current_sma200_w = float(sma200_series.iloc[-1])
                    
                    if not np.isnan(current_sma200_w) and current_sma200_w > 0:
                        # 1. Macro Trend: Stock arrived from the UPSIDE (was in a secular bull market)
                        # Average of prior 15-40 weeks was safely above 200W-SMA (+3% or higher)
                        prior_w_close = weekly_close.iloc[-40:-8]
                        prior_w_sma = sma200_series.iloc[-40:-8]
                        was_above_from_upside = (prior_w_close.mean() > prior_w_sma.mean() * 1.03) if len(prior_w_close) >= 8 else False
                        
                        # 2. Touch / Sweep Zone: Low within last 10 sessions tested 200W-SMA
                        recent_10d_low = float(low.iloc[-10:].min())
                        touched_200w = (recent_10d_low <= current_sma200_w * 1.025) and (recent_10d_low >= current_sma200_w * 0.94)
                        
                        # 3. Institutional Defense: Current close holds above or at 200W-SMA
                        holds_200w = curr_c >= (current_sma200_w * 0.985)
                        
                        if was_above_from_upside and touched_200w and holds_200w:
                            has_200w_touch = True
                            sma200_w = current_sma200_w
                            # Check if the low briefly swept under 200W-SMA and closed back above (classic liquidity sweep)
                            if recent_10d_low < current_sma200_w and curr_c > current_sma200_w:
                                swept_200w = True
        except Exception:
            pass

        # ---------------------------------------------------------
        # Branch 2: Daily Bullish RSI Divergence
        # ---------------------------------------------------------
        rsi = calculate_rsi(close, 14)
        has_bull_div = False
        div_pts = 0.0
        p1, p2 = None, None
        r1, r2 = None, None
        idx1, idx2 = None, None
        
        if not rsi.empty and len(rsi) >= 40:
            # Lookback windows for swing troughs:
            # Trough 1: 12 to 35 bars ago (initial flush into oversold territory)
            # Trough 2: 2 to 10 bars ago (secondary test / stop run)
            w1 = low.iloc[-35:-10]
            w2 = low.iloc[-10:-1]
            if len(w1) >= 5 and len(w2) >= 3:
                cand_idx1 = w1.idxmin()
                cand_idx2 = w2.idxmin()
                cand_p1 = float(w1.min())
                cand_p2 = float(w2.min())
                cand_r1 = float(rsi.loc[cand_idx1])
                cand_r2 = float(rsi.loc[cand_idx2])
                
                # Prerequisite: First trough occurred in oversold/washout territory (< 42)
                # Bullish Momentum Divergence: P2 <= P1 * 1.02 while RSI prints higher low (+2.0 pts)
                if cand_r1 < 42.0 and (cand_p2 <= cand_p1 * 1.02) and (cand_r2 >= cand_r1 + 2.0):
                    has_bull_div = True
                    p1, p2 = cand_p1, cand_p2
                    r1, r2 = cand_r1, cand_r2
                    idx1, idx2 = cand_idx1, cand_idx2
                    div_pts = round(r2 - r1, 1)

        # ---------------------------------------------------------
        # Anchor Prerequisite Check: Must have EITHER Divergence OR 200W-SMA Touch
        # ---------------------------------------------------------
        if not (has_bull_div or has_200w_touch):
            return None

        # ---------------------------------------------------------
        # Structural SMC Confirmation (Liquidity Grab & CHoCH)
        # ---------------------------------------------------------
        # Determine reference swing low for liquidity sweep
        if has_bull_div and p1 is not None and p2 is not None:
            trough2_close = float(close.loc[idx2])
            swept_trough1 = (p2 < p1 * 0.998) and (trough2_close >= p1 * 0.99)
            recent_sweep = any(low.iloc[-5:] < p1 * 0.998) and (curr_c >= p1 * 0.99)
            has_liquidity_grab = swept_trough1 or recent_sweep or swept_200w
            
            mid_highs = high.loc[idx1:idx2]
            swing_high = float(mid_highs.max()) if len(mid_highs) > 0 else (p1 * 1.05)
        else:
            # 200-Weekly SMA anchor mode:
            # Liquidity sweep of either 200W-SMA or prior 15-day pivot low
            prior_low_15d = float(low.iloc[-25:-8].min()) if len(low) >= 25 else curr_l
            recent_low_8d = float(low.iloc[-8:].min())
            swept_prior_low = (recent_low_8d < prior_low_15d * 0.998) and (curr_c >= prior_low_15d * 0.985)
            has_liquidity_grab = swept_200w or swept_prior_low
            
            # Swing high is the resistance ceiling formed before the 200W test
            swing_high = float(high.iloc[-18:-3].max()) if len(high) >= 18 else (curr_c * 1.04)

        # CHoCH (Change of Character): Price broke or tested interim structural swing high
        has_choch = (curr_c >= swing_high * 0.995) or any(close.iloc[-3:] >= swing_high)
        
        # Short-term 10-EMA Reclamation:
        ema10 = float(close.ewm(span=10, adjust=False).mean().iloc[-1])
        reclaimed_ema10 = curr_c > ema10
        
        # Candlestick Confirmation:
        candle_range = curr_h - curr_l
        close_in_upper = ((curr_c - curr_l) >= (candle_range * 0.40)) if candle_range > 0 else True
        bullish_candle = (curr_c >= curr_o * 0.995) or close_in_upper
        if not bullish_candle:
            return None
            
        # The setup MUST be structurally resolved:
        # Either CHoCH, or Liquidity Grab + EMA10, or Breakout near swing high
        is_resolved = has_choch or (has_liquidity_grab and reclaimed_ema10) or (curr_c >= swing_high * 0.98 and reclaimed_ema10) or (has_200w_touch and reclaimed_ema10)
        if not is_resolved:
            return None
            
        # ---------------------------------------------------------
        # Pattern Labels & Confluence Scoring
        # ---------------------------------------------------------
        pattern_labels = []
        is_confluence = has_200w_touch and has_bull_div
        
        if is_confluence:
            pattern_labels.append("🔥 200W-SMA + RSI Div")
        elif has_200w_touch:
            pattern_labels.append(f"200W-SMA Defense (${sma200_w:.2f})")
        elif has_bull_div:
            pattern_labels.append(f"RSI Div (+{div_pts}pts)")
            
        if has_liquidity_grab:
            pattern_labels.append("Liquidity Grab")
            
        if has_choch:
            pattern_labels.append("CHoCH")
        elif reclaimed_ema10:
            pattern_labels.append("EMA-10 Reclaimed")
        else:
            pattern_labels.append("W-Bottom")
            
        pattern_str = " + ".join(pattern_labels)
        
        # Quantitative Scoring:
        # Base 80 + bonuses for CHoCH (+15), Liquidity Grab (+10), 200W-SMA Defense (+12), Confluence (+15)
        score = 80.0
        if has_bull_div:
            score += min(div_pts, 8.0)
        if has_200w_touch:
            score += 12.0
        if is_confluence:
            score += 15.0  # Elite Tier-0 Setup
        if has_choch:
            score += 15.0
        if has_liquidity_grab:
            score += 10.0
        if reclaimed_ema10:
            score += 5.0
            
        metric_desc = f"{pattern_str}"
        if has_200w_touch and not is_confluence:
            metric_desc = f"200W-SMA (${sma200_w:.2f}) Defense + {pattern_labels[-1]}"
        elif is_confluence:
            metric_desc = f"🔥 Confluence: 200W-SMA (${sma200_w:.2f}) + RSI Div (+{div_pts}pts) + {pattern_labels[-1]}"
        elif has_bull_div:
            metric_desc = f"{pattern_str} | +{div_pts}pts RSI Div"

        return {
            "ticker": ticker,
            "pattern": pattern_str,
            "has_200w_touch": has_200w_touch,
            "has_bull_div": has_bull_div,
            "is_confluence": is_confluence,
            "sma200_w": round(float(sma200_w), 2) if sma200_w is not None else None,
            "div_pts": div_pts,
            "has_choch": has_choch,
            "has_liquidity_grab": has_liquidity_grab,
            "price": round(float(curr_c), 2),
            "score": round(float(score), 1),
            "metric": metric_desc
        }
    except Exception as e:
        return None
