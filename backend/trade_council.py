import concurrent.futures
import pandas as pd
import numpy as np

class TradeCouncil:
    @staticmethod
    def _volatility_agent(hist: pd.DataFrame):
        # Calculate 14-day ATR (Average True Range)
        high_low = hist['High'] - hist['Low']
        high_close = (hist['High'] - hist['Close'].shift()).abs()
        low_close = (hist['Low'] - hist['Close'].shift()).abs()
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = ranges.max(axis=1)
        
        # Handle cases with less than 14 days
        period = min(14, len(hist))
        atr = true_range.rolling(period).mean().iloc[-1]
        
        atr_10 = true_range.rolling(min(10, len(hist))).mean().iloc[-1]
        if pd.isna(atr_10): atr_10 = atr
        
        # Expected Move (Annualized Historical Volatility)
        daily_returns = np.log(hist['Close'] / hist['Close'].shift(1))
        daily_vol = daily_returns.std()
        expected_move_5d = hist['Close'].iloc[-1] * daily_vol * np.sqrt(5) if not pd.isna(daily_vol) else atr * 2
        
        if pd.isna(atr):
            atr = (hist['High'] - hist['Low']).mean()
            atr_10 = atr
            
        current_price = hist['Close'].iloc[-1]
        stop_loss = current_price - (atr * 1.5)
        return {'atr': atr, 'atr_10': atr_10, 'expected_move_5d': expected_move_5d, 'suggested_stop': stop_loss}

    @staticmethod
    def _structural_agent(hist: pd.DataFrame):
        # Look back 20 periods for immediate floor support
        lookback = min(20, len(hist))
        last_n = hist.tail(lookback)
        support = last_n['Low'].min()
        
        # Ceiling is the highest high in the entire provided history (typically 60-90 days)
        resistance = hist['High'].max()
        
        return {'support': support, 'resistance': resistance}

    @staticmethod
    def _volume_agent(hist: pd.DataFrame):
        # Identify Anchored VWAP from the highest volume node
        try:
            max_vol_idx = hist['Volume'].idxmax()
            post_vol_data = hist.loc[max_vol_idx:]
            
            if len(post_vol_data) > 0:
                typical_price = (post_vol_data['High'] + post_vol_data['Low'] + post_vol_data['Close']) / 3
                vwap = (typical_price * post_vol_data['Volume']).cumsum() / post_vol_data['Volume'].cumsum()
                anchored_vwap = vwap.iloc[-1]
            else:
                anchored_vwap = hist['Close'].iloc[-1]
                
            return {'anchored_vwap': anchored_vwap, 'anchor_date': max_vol_idx}
        except Exception:
            return {'anchored_vwap': hist['Close'].iloc[-1], 'anchor_date': None}

    @staticmethod
    def _trend_agent(hist: pd.DataFrame):
        period = min(20, len(hist))
        ema_3 = hist['Close'].ewm(span=min(3, len(hist)), adjust=False).mean().iloc[-1]
        ema_5 = hist['Close'].ewm(span=min(5, len(hist)), adjust=False).mean().iloc[-1]
        ema_10 = hist['Close'].ewm(span=min(10, len(hist)), adjust=False).mean().iloc[-1]
        ema_21 = hist['Close'].ewm(span=min(21, len(hist)), adjust=False).mean().iloc[-1]
        sma_20 = hist['Close'].rolling(period).mean().iloc[-1]
        sma_50 = hist['Close'].rolling(min(50, len(hist))).mean().iloc[-1]
        sma_150 = hist['Close'].rolling(min(150, len(hist))).mean().iloc[-1]
        sma_200 = hist['Close'].rolling(min(200, len(hist))).mean().iloc[-1]
        
        std = hist['Close'].rolling(period).std().iloc[-1]
        if pd.isna(std): std = 0
        
        bb_up = sma_20 + (std * 2)
        bb_down = sma_20 - (std * 2)
        
        bb_width_pct = (bb_up - bb_down) / sma_20 if sma_20 > 0 else 0
        
        # 15-day pivot
        pivot_15d = hist['High'].tail(min(15, len(hist))).max()
        
        # Fib levels
        swing_low = hist['Low'].min()
        swing_high = hist['High'].max()
        fib_382 = swing_high - (0.382 * (swing_high - swing_low))
        fib_500 = swing_high - (0.500 * (swing_high - swing_low))
        
        return {
            'ema_3': ema_3,
            'ema_5': ema_5,
            'ema_10': ema_10,
            'ema_21': ema_21,
            'sma_20': sma_20,
            'sma_50': sma_50,
            'sma_150': sma_150,
            'sma_200': sma_200,
            'bb_up': bb_up,
            'bb_down': bb_down,
            'bb_width_pct': bb_width_pct,
            'pivot_15d': pivot_15d,
            'fib_382': fib_382,
            'fib_500': fib_500
        }

    @staticmethod
    def evaluate(ticker: str, hist: pd.DataFrame):
        # Normalize column names for cross-library compatibility (yahooquery vs yfinance)
        hist.rename(columns=lambda x: x.title() if isinstance(x, str) else x, inplace=True)
        
        current_price = hist['Close'].iloc[-1]
        
        # Fallback if history is insanely short
        if len(hist) < 5:
            atr_proxy = (hist['High'] - hist['Low']).mean()
            sl = round(max(current_price - (atr_proxy * 1.5), current_price * 0.90), 2)
            pt = round(current_price + (current_price - sl) * 2.5, 2)
            return {
                'entry': round(current_price, 2), 
                'stop_loss': sl, 
                'profit_target': pt,
                'support_level': sl,
                'anchored_vwap': round(current_price, 2)
            }

        # Run Council Members in Parallel
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            f_vol = executor.submit(TradeCouncil._volatility_agent, hist)
            f_struct = executor.submit(TradeCouncil._structural_agent, hist)
            f_vol_prof = executor.submit(TradeCouncil._volume_agent, hist)
            f_trend = executor.submit(TradeCouncil._trend_agent, hist)
            
            vol_data = f_vol.result()
            struct_data = f_struct.result()
            vol_prof_data = f_vol_prof.result()
            trend_data = f_trend.result()
            
        # --- Synthesizer (Chief Risk Officer) ---
        
        # 1. Determine Optimal Entry Zone Context
        is_parabolic = current_price > (trend_data['sma_20'] * 1.10) # > 10% extended
        is_extended = current_price > (trend_data['sma_20'] * 1.05) and not is_parabolic
        is_consolidating = trend_data['bb_width_pct'] < 0.12 # 12% width indicates tight chop
        
        # Check Trend Template: 50 > 150 > 200
        trend_template_active = (trend_data['sma_50'] > trend_data['sma_150']) and (trend_data['sma_150'] > trend_data['sma_200'])
        
        hoy = hist['High'].iloc[-1]
        lod = hist['Low'].iloc[-1]
        atr = vol_data['atr']
        
        if is_parabolic:
            # Parabolic Momentum Breakout Logic (Qullamaggie EP / Momentum)
            entry = hoy + (0.05 * atr)
            setup_type = "Parabolic Momentum Tracker"
            
        elif is_extended:
            # Mean Reversion Pullback Logic
            entry = max(trend_data['ema_21'], vol_prof_data['anchored_vwap']) * 1.02
            setup_type = "Mean Reversion Pullback"
            
        elif is_consolidating and trend_template_active:
            # Momentum Breakout Logic (VCP / CANSLIM)
            pivot = trend_data['pivot_15d']
            entry = pivot + (0.10 * atr)
            setup_type = "Composite Breakout (VCP)"
            
        else:
            # Fallback Pivot Logic
            entry = hoy + (0.05 * atr)
            setup_type = "Trend Continuation Pivot"

        # Cap optimal_entry fallback
        if entry < current_price * 0.70 or entry > current_price * 1.30:
            entry = current_price
        
        # 2. Evaluate Stop Loss
        highest_high_22 = hist['High'].tail(22).max()
        
        if setup_type == "Composite Breakout (VCP)":
            # Tightest between Swing Low (lod) - 0.1 ATR and Volatility Floor (entry - 1.5 ATR)
            tech_sl = lod - (0.1 * atr)
            vol_sl = entry - (1.5 * atr)
            final_sl = max(tech_sl, vol_sl)
        elif setup_type == "Parabolic Momentum Tracker":
            # Chandelier Exit (Highest High - 3.0 ATR)
            chandelier_exit = highest_high_22 - (3.0 * atr)
            ema_valid = trend_data['ema_10'] if trend_data['ema_10'] < entry else 0
            avwap_valid = vol_prof_data['anchored_vwap'] if vol_prof_data['anchored_vwap'] < entry else 0
            final_sl = max([chandelier_exit, ema_valid, avwap_valid])
        elif setup_type == "Mean Reversion Pullback":
            # Minimum of AVWAP or swing low - 1 ATR
            final_sl = min(vol_prof_data['anchored_vwap'], struct_data['support']) - (1.0 * atr)
        else:
            final_sl = entry - (1.5 * atr)
        
        # Ensure stop is logically below entry
        if final_sl >= entry:
            final_sl = entry - (1.0 * atr)
            
        risk_dollars = entry - final_sl
        
        # 3. Evaluate Profit Target
        if setup_type == "Composite Breakout (VCP)":
            # 3.0R Asymmetric Target
            final_pt = entry + (3.0 * risk_dollars)
        elif setup_type == "Parabolic Momentum Tracker":
            # Target 2.5R to 3.0R multiple
            final_pt = entry + (2.5 * risk_dollars)
        elif setup_type == "Mean Reversion Pullback":
            # Fibonacci 1.618 Extension
            swing_low = struct_data['support']
            swing_high = struct_data['resistance']
            swing_range = swing_high - swing_low
            final_pt = swing_high + (swing_range * 0.618)
        else:
            final_pt = entry + (3.0 * risk_dollars)
            
        # Format the entry zone dynamically
        entry_str = f"{entry:.2f}"
            
        return {
            'entry': round(entry, 2),
            'entry_str': entry_str,
            'stop_loss': round(final_sl, 2),
            'profit_target': round(final_pt, 2),
            'support_level': round(struct_data['support'], 2),
            'anchored_vwap': round(vol_prof_data['anchored_vwap'], 2),
            'setup_type': setup_type
        }

if __name__ == "__main__":
    # Quick standalone test
    import yfinance as yf
    print("Testing Council on SPY...")
    t = yf.Ticker("SPY")
    h = t.history(period="3mo")
    plan = TradeCouncil.evaluate("SPY", h)
    print("Trade Plan:", plan)
