import concurrent.futures
import pandas as pd
import numpy as np
try:
    from scipy.signal import find_peaks
except ImportError:
    find_peaks = None

class TradeCouncil:
    @staticmethod
    def _detect_vcp_waves(hist: pd.DataFrame):
        """
        Mark Minervini Volatility Contraction Pattern (VCP) Quantitative Detector:
        1. Analyzes 20-75 day base structure.
        2. Detects swing peaks and troughs.
        3. STRICT DISQUALIFIER: Downward channel (Peak2 < Peak1 AND Trough2 < Trough1) is NEVER a VCP.
        4. Lower Lows (Trough2 < Trough1) is NEVER a VCP.
        5. Requires contracting wave depths (Depth2 < Depth1 * 0.85).
        6. Requires right-side pivot proximity (within 8% of pivot peak).
        7. Requires right-side volatility contraction (ATR5 <= ATR20 * 0.92).
        """
        if len(hist) < 50 or find_peaks is None:
            return False, {}
            
        base_window = min(75, len(hist))
        base_df = hist.iloc[-base_window:]
        
        peak_indices, _ = find_peaks(base_df['High'].values, distance=5, prominence=base_df['High'].std()*0.25)
        trough_indices, _ = find_peaks(-base_df['Low'].values, distance=5, prominence=base_df['Low'].std()*0.25)
        
        if len(peak_indices) < 2 or len(trough_indices) < 2:
            return False, {}
            
        waves = []
        for p_idx in peak_indices:
            subs = [t for t in trough_indices if t > p_idx]
            if subs:
                t_idx = subs[0]
                p_price = base_df['High'].iloc[p_idx]
                t_price = base_df['Low'].iloc[t_idx]
                depth = (p_price - t_price) / p_price
                waves.append({'depth': depth, 'peak': p_price, 'trough': t_price, 'p_idx': p_idx, 't_idx': t_idx})
                
        if len(waves) < 2:
            return False, {}
            
        w1, w2 = waves[-2], waves[-1]
        
        # Immediate Disqualifier 1: Downward channel (Lower High + Lower Low)
        if w2['peak'] < w1['peak'] and w2['trough'] < w1['trough']:
            return False, {}
            
        # Immediate Disqualifier 2: Lower Low
        if w2['trough'] < w1['trough']:
            return False, {}
            
        # Wave depth contraction: W2 must contract by at least 15% relative to W1
        contracting_depth = w2['depth'] < (w1['depth'] * 0.85)
        
        # Proximity to pivot: must be within 8% of highest base peak
        highest_peak = max(w1['peak'], w2['peak'])
        current_price = hist['Close'].iloc[-1]
        dist_to_piv = (highest_peak - current_price) / highest_peak
        near_pivot = 0.0 <= dist_to_piv <= 0.08
        
        # Volatility drying up on right side (ATR contraction)
        hl = hist['High'] - hist['Low']
        hc = (hist['High'] - hist['Close'].shift()).abs()
        lc = (hist['Low'] - hist['Close'].shift()).abs()
        tr = pd.concat([hl, hc, lc], axis=1).max(axis=1)
        atr5 = tr.rolling(5).mean().iloc[-1]
        atr20 = tr.rolling(min(20, len(hist))).mean().iloc[-1]
        vol_contracting = atr5 <= (atr20 * 0.92)
        
        if contracting_depth and near_pivot and vol_contracting:
            return True, {
                'w1_depth': f"{w1['depth']*100:.1f}%",
                'w2_depth': f"{w2['depth']*100:.1f}%",
                'pivot': highest_peak,
                't2_low': w2['trough']
            }
            
        return False, {}

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

        # Swing structure analysis over consolidation window (15-20 bars)
        window_size = min(16, len(hist))
        tail_window = hist.tail(window_size)
        half = max(1, len(tail_window) // 2)
        
        first_half = tail_window.iloc[:half]
        second_half = tail_window.iloc[half:]
        
        h1, l1 = first_half['High'].max(), first_half['Low'].min()
        h2, l2 = second_half['High'].max(), second_half['Low'].min()
        
        x = np.arange(len(tail_window))
        slope_h, _ = np.polyfit(x, tail_window['High'], 1) if len(tail_window) >= 3 else (0.0, 0.0)
        slope_l, _ = np.polyfit(x, tail_window['Low'], 1) if len(tail_window) >= 3 else (0.0, 0.0)
        
        # Lower highs and lower lows indicate downward channel / orderly pullback, NOT a VCP
        is_lower_highs = (h2 < h1 * 0.99) and (slope_h < 0)
        is_lower_lows = (l2 < l1 * 0.99) and (slope_l < 0)
        is_downward_channel = is_lower_highs and is_lower_lows
        
        # True Minervini VCP requires lows to form higher lows or hold a flat support shelf
        is_higher_lows = (l2 >= l1 * 0.985) and not is_downward_channel
        recent_pullback_low = tail_window['Low'].tail(min(5, len(tail_window))).min()
        
        # High-Tight Flag check: +20% pole in last 30-45 sessions, consolidating near highs above 21-EMA
        pole_low = hist['Low'].tail(45).head(25).min() if len(hist) >= 45 else hist['Low'].min()
        pole_high = hist['High'].tail(25).max()
        pole_gain = (pole_high - pole_low) / pole_low if pole_low > 0 else 0
        near_pole_high = (pole_high - hist['Close'].iloc[-1]) / pole_high < 0.08
        is_high_tight_flag = (pole_gain >= 0.20) and near_pole_high and (hist['Close'].iloc[-1] >= ema_21)
        
        is_higher_highs = (h2 > h1 * 1.01) and (slope_h > 0)
        is_higher_lows = (l2 > l1 * 1.01) and (slope_l > 0)
        is_ascending_channel = is_higher_highs and is_higher_lows
        
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
            'fib_500': fib_500,
            'is_downward_channel': is_downward_channel,
            'is_higher_lows': is_higher_lows,
            'is_high_tight_flag': is_high_tight_flag,
            'is_ascending_channel': is_ascending_channel,
            'slope_h': slope_h,
            'slope_l': slope_l,
            'recent_pullback_low': recent_pullback_low
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
                'entry_str': f"{current_price:.2f}",
                'stop_loss': sl, 
                'profit_target': pt,
                'support_level': sl,
                'anchored_vwap': round(current_price, 2),
                'setup_type': 'Trend Continuation Pivot'
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
        
        # Check Trend Template: 50 > 150 > 200
        trend_template_active = (trend_data['sma_50'] > trend_data['sma_150']) and (trend_data['sma_150'] > trend_data['sma_200'])
        
        # Distance to key institutional moving averages
        near_50_sma = abs(current_price - trend_data['sma_50']) / trend_data['sma_50'] < 0.035
        near_21_ema = abs(current_price - trend_data['ema_21']) / trend_data['ema_21'] < 0.035
        
        # Pure Minervini VCP check
        is_true_vcp, vcp_info = TradeCouncil._detect_vcp_waves(hist)
        
        hoy = hist['High'].iloc[-1]
        lod = hist['Low'].iloc[-1]
        atr = vol_data['atr']
        pivot_15d = trend_data['pivot_15d']
        
        if is_parabolic:
            # Parabolic Momentum Breakout Logic (Qullamaggie EP / Momentum)
            entry = hoy + (0.05 * atr)
            setup_type = "Parabolic Momentum Tracker"
            
        elif is_true_vcp and trend_template_active:
            # Verified Minervini Volatility Contraction Pattern (VCP)
            pivot = vcp_info.get('pivot', pivot_15d)
            entry = pivot + (0.05 * atr)
            setup_type = "Composite Breakout (VCP)"
            
        elif trend_data['is_downward_channel']:
            # Lower highs & lower lows drifting into institutional MA support = Orderly Pullback (NOT a VCP!)
            if near_50_sma:
                setup_type = "Pullback to 50-SMA Support"
            elif near_21_ema:
                setup_type = "Pullback to 21-EMA Support"
            else:
                setup_type = "Downward Channel Consolidation"
            
            # Tactical pullback reversal trigger
            entry = max(hoy + (0.05 * atr), trend_data['ema_10'])
            if current_price >= entry:
                entry = hoy + (0.05 * atr)
                
        elif trend_data['is_high_tight_flag'] and trend_template_active:
            # High-Tight Flag Breakout
            entry = pivot_15d + (0.05 * atr)
            setup_type = "High-Tight Flag Breakout"
            
        elif trend_data['is_ascending_channel'] and trend_template_active:
            # Ascending Momentum Channel Breakout
            entry = pivot_15d + (0.05 * atr)
            setup_type = "Ascending Momentum Breakout"
            
        elif trend_template_active and (near_50_sma or near_21_ema or trend_data['bb_width_pct'] < 0.12):
            # Horizontal Flat Base / Range Consolidation (e.g. JPM, BAC, AAPL)
            entry = pivot_15d + (0.05 * atr)
            setup_type = "Flat Base Consolidation"
            
        elif is_extended:
            # Mean Reversion Pullback Logic
            entry = max(trend_data['ema_21'], vol_prof_data['anchored_vwap']) * 1.02
            setup_type = "Mean Reversion Pullback"
            
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
            # Anchored to the higher-low trough (T2)
            t2_low = vcp_info.get('t2_low', lod)
            final_sl = t2_low - (0.15 * atr)
        elif setup_type in ["Flat Base Consolidation", "Ascending Momentum Breakout"]:
            support_ma = trend_data['sma_50'] if near_50_sma else trend_data['ema_21']
            structural_floor = min(trend_data['recent_pullback_low'], support_ma)
            final_sl = structural_floor - (0.20 * atr)
        elif setup_type == "High-Tight Flag Breakout":
            flag_floor = min(lod, trend_data['ema_21'])
            final_sl = flag_floor - (0.15 * atr)
        elif "Pullback" in setup_type or "Downward Channel" in setup_type:
            support_ma = trend_data['sma_50'] if "50-SMA" in setup_type else trend_data['ema_21']
            structural_floor = min(trend_data['recent_pullback_low'], support_ma)
            final_sl = structural_floor - (0.20 * atr)
        elif setup_type == "Parabolic Momentum Tracker":
            chandelier_exit = highest_high_22 - (3.0 * atr)
            ema_valid = trend_data['ema_10'] if trend_data['ema_10'] < entry else 0
            avwap_valid = vol_prof_data['anchored_vwap'] if vol_prof_data['anchored_vwap'] < entry else 0
            final_sl = max([chandelier_exit, ema_valid, avwap_valid])
        elif setup_type == "Mean Reversion Pullback":
            final_sl = min(vol_prof_data['anchored_vwap'], struct_data['support']) - (1.0 * atr)
        else:
            final_sl = entry - (1.5 * atr)
        
        # Ensure stop is logically below entry and below current price
        if final_sl >= entry:
            final_sl = entry - (1.0 * atr)
        if final_sl >= current_price:
            final_sl = current_price - (0.5 * atr)
            
        risk_dollars = max(0.01, entry - final_sl)
        
        # 3. Evaluate Profit Target
        if setup_type == "Composite Breakout (VCP)":
            # 3.0R Asymmetric Target
            final_pt = entry + (3.0 * risk_dollars)
        elif setup_type in ["Flat Base Consolidation", "High-Tight Flag Breakout", "Ascending Momentum Breakout"]:
            final_pt = entry + (3.0 * risk_dollars)
        elif "Pullback" in setup_type or "Downward Channel" in setup_type:
            # 2.5R Target or Retest of Upper Pivot High
            final_pt = max(trend_data['pivot_15d'], entry + (2.5 * risk_dollars))
        elif setup_type == "Parabolic Momentum Tracker":
            final_pt = entry + (2.5 * risk_dollars)
        elif setup_type == "Mean Reversion Pullback":
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
