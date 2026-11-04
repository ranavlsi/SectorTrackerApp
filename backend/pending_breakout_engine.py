import numpy as np
import pandas as pd
import yfinance as yf
import logging

logger = logging.getLogger(__name__)

def calculate_atr(df, period=20):
    high_low = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift(1))
    low_close = np.abs(df['Low'] - df['Close'].shift(1))
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = ranges.max(axis=1)
    return true_range.rolling(period).mean()

def detect_pending_breakout(ticker: str, pre_df=None):
    """
    Evaluates a ticker for an ultra-strict Pending Breakout signature using a 3-pillar VCP model.
    """
    try:
        if pre_df is not None:
            data = pre_df.copy()
        else:
            from yahooquery import Ticker as YQTicker
            t = YQTicker(ticker)
            data = t.history(period="6mo", interval="1d")
            if data is None or data.empty or ticker.lower() not in data.index.get_level_values(0).str.lower(): return None
            data = data.loc[ticker.lower() if ticker.lower() in data.index.levels[0] else ticker].reset_index()
            data.rename(columns={'close':'Close', 'high':'High', 'low':'Low', 'open':'Open', 'volume':'Volume'}, inplace=True)
            
        if len(data) < 125:
            return None
            
        # Failsafe: Ensure columns are Series
        for col in ['Close', 'High', 'Low', 'Volume']:
            if col in data and isinstance(data[col], pd.DataFrame):
                data[col] = data[col].iloc[:, 0]
                
        df = data.copy()
        
        # --- PILLAR 1: STRUCTURAL TREND & BASE INTEGRITY ---
        df['SMA_50'] = df['Close'].rolling(50).mean()
        df['SMA_200'] = df['Close'].rolling(200).mean()
        
        # We need a stage 2 uptrend
        trend_aligned = (df['Close'].iloc[-1] > df['SMA_50'].iloc[-1]) and (df['SMA_50'].iloc[-1] > df['SMA_200'].iloc[-1] if len(df) >= 200 else True)
        
        if not trend_aligned: return None
        
        df['Base_High'] = df['High'].rolling(120).max()
        df['Base_Low'] = df['Low'].rolling(120).min()
        
        base_depth = (df['Base_High'].iloc[-1] - df['Base_Low'].iloc[-1]) / df['Base_High'].iloc[-1]
        if base_depth > 0.65: return None # Base is too deep/loose (>65%)
        
        # Position in base (Must be top 25%)
        pos_in_base = (df['Close'].iloc[-1] - df['Base_Low'].iloc[-1]) / (df['Base_High'].iloc[-1] - df['Base_Low'].iloc[-1])
        if pos_in_base < 0.70: return None # Squeezing too low in the base
        
        # Extension & Already-Broken-Out Disqualifier:
        # 1) Must be strictly BELOW the 20-day resistance pivot (0.1% to 12% beneath pivot, NEVER above it!)
        df['Local_Pivot'] = df['High'].shift(1).rolling(20).max()
        local_pivot = float(df['Local_Pivot'].iloc[-1])
        close = float(df['Close'].iloc[-1])
        prev_close = float(df['Close'].iloc[-2]) if len(df) >= 2 else close
        
        dist_to_pivot = (local_pivot - close) / local_pivot if local_pivot > 0 else 0.0
        if dist_to_pivot < 0.001 or dist_to_pivot > 0.12:
            return None

        # 2) Structural Base Ceiling Check:
        # Prevent a multi-day breakout rally (where Local_Pivot just resets to yesterday's breakout high)
        # from being misclassified as a pending squeeze. Close must not exceed the prior base ceiling [-45:-5].
        structural_pivot = float(df['High'].iloc[-45:-5].max()) if len(df) >= 45 else local_pivot
        if close > structural_pivot * 1.005:
            return None

        # 3) Multi-day / Single-day Expansion Filter:
        # If the stock has already surged > +8% over the last 10 trading days or >= +3.5% today, it is already breaking out.
        ret_10d = (close / float(df['Close'].iloc[-11])) - 1.0 if len(df) >= 11 else 0.0
        day_gain = (close / prev_close) - 1.0 if prev_close > 0 else 0.0
        if ret_10d > 0.08 or day_gain >= 0.035:
            return None
        
        # Smoothness (1.2% <= ADR_20 <= 7.5% — filters out both <1.2% merger-arb buyout pins and >7.5% choppy whipsaws)
        df['Daily_Range'] = (df['High'] / df['Low']) - 1
        adr_20 = float(df['Daily_Range'].rolling(20).mean().iloc[-1] * 100)
        if adr_20 < 1.2 or adr_20 > 7.5:
            return None
        
        # --- PILLAR 2: THE VOLUME FOOTPRINT ---
        df['Vol_SMA_50'] = df['Volume'].rolling(50).mean()
        
        # Volume Dry Up (VDU): At least one day in last 5 < 50% of 50SMA
        df['Is_VDU'] = df['Volume'] < (0.5 * df['Vol_SMA_50'])
        vdu_recent = df['Is_VDU'].iloc[-5:].any()
        if not vdu_recent: return None
        
        # Supply Absorption (Up vs Down Volume)
        df['Is_Up_Day'] = df['Close'] > df['Close'].shift(1)
        df['Is_Down_Day'] = df['Close'] < df['Close'].shift(1)
        df['Up_Vol'] = np.where(df['Is_Up_Day'], df['Volume'], 0)
        df['Down_Vol'] = np.where(df['Is_Down_Day'], df['Volume'], 0)
        up_vol_50 = df['Up_Vol'].rolling(50).sum().iloc[-1]
        down_vol_50 = df['Down_Vol'].rolling(50).sum().iloc[-1]
        
        up_down_ratio = up_vol_50 / down_vol_50 if down_vol_50 > 0 else 1.0
        if up_down_ratio < 1.05: return None # Not enough institutional accumulation
        
        # --- PILLAR 3: BOUNDED QUANTITATIVE SQUEEZE ---
        df['ATR_5'] = calculate_atr(df, 5)
        df['ATR_20'] = calculate_atr(df, 20)
        
        # VCP Volatility Contraction
        vol_contraction = df['ATR_5'].iloc[-1] < (df['ATR_20'].iloc[-1] * 0.85)
        if not vol_contraction: return None
        
        # TTM Squeeze Component
        df['BB_Mid'] = df['Close'].rolling(20).mean()
        df['BB_Std'] = df['Close'].rolling(20).std()
        df['BB_Upper'] = df['BB_Mid'] + (2 * df['BB_Std'])
        df['BB_Lower'] = df['BB_Mid'] - (2 * df['BB_Std'])
        
        df['KC_Upper'] = df['BB_Mid'] + (1.5 * df['ATR_20'])
        df['KC_Lower'] = df['BB_Mid'] - (1.5 * df['ATR_20'])
        
        # Disqualify if price is already piercing outside the upper Bollinger Band
        if close >= float(df['BB_Upper'].iloc[-1]):
            return None

        ttm_squeeze = (df['BB_Upper'].iloc[-1] < df['KC_Upper'].iloc[-1]) and (df['BB_Lower'].iloc[-1] > df['KC_Lower'].iloc[-1])
        
        # --- PILLAR 9: RELATIVE MOMENTUM VECTOR (RMV) ---
        ema20 = float(df['Close'].ewm(span=20, adjust=False).mean().iloc[-1])
        atr20 = float(df['ATR_20'].iloc[-1]) if float(df['ATR_20'].iloc[-1]) > 0 else 1.0
        rmv = (close - ema20) / atr20

        # A true Pending Breakout must still be coiling near its 20-EMA (RMV <= +1.35σ), not already extended in a breakout trend
        if rmv > 1.35 or rmv < -1.50:
            return None

        rmv_status = f"RMV {rmv:+.2f}σ (Coiled Vector)"

        # PASSES ALL TESTS! We have a genuine pre-breakout structural VCP.
        alerts = [{
            "model": "V2 VCP Squeeze",
            "details": f"VCP setup coiled {dist_to_pivot*100:.1f}% under local pivot (${local_pivot:.2f}). Accumulation ratio: {up_down_ratio:.2f}x."
        }]
        
        if ttm_squeeze:
            alerts.append({
                "model": "TTM Squeeze Active",
                "details": "Bollinger Bands have compressed inside the Keltner Channels, indicating an imminent explosive move."
            })

        alerts.append({
            "model": "Relative Momentum Vector (RMV)",
            "details": f"Price velocity coiling at {rmv_status}. Vector compression prior to expansion."
        })

        # --- ADVANCED QUANTITATIVE CATALYSTS ---
        # We use try/except block to avoid crashing the base scanner if yfinance API fails
        try:
            t_obj = yf.Ticker(ticker)
            info = t_obj.info
            
            # PILLAR 4: SHORT SQUEEZE FUEL
            short_float = info.get('shortPercentOfFloat', 0)
            if short_float is not None and short_float > 0.15:
                alerts.append({
                    "model": "Short Squeeze Fuel",
                    "details": f"Coiled Spring: High Short Float ({short_float*100:.1f}%) trapped inside tight VCP."
                })
                
            # PILLAR 5: MICRO-STRUCTURE ORDER FLOW PROXY
            high = df['High'].iloc[-1]
            low = df['Low'].iloc[-1]
            close_p = df['Close'].iloc[-1]
            
            chr_val = (close_p - low) / (high - low) if high > low else 0.5
            if chr_val > 0.85:
                alerts.append({
                    "model": "Order Flow Absorption",
                    "details": f"Aggressive buyers controlled the daily close (CHR: {chr_val:.2f}), absorbing supply at resistance."
                })
                
            # PILLAR 6: DARK POOL / BLOCK TRADE ANOMALY
            rvol = df['Volume'].iloc[-1] / df['Vol_SMA_50'].iloc[-1] if df['Vol_SMA_50'].iloc[-1] > 0 else 0
            daily_range_pct = (high / low) - 1
            if rvol > 2.0 and daily_range_pct < 0.02:
                alerts.append({
                    "model": "Dark Pool Block Trade",
                    "details": f"Massive relative volume ({rvol:.1f}x) without price expansion ({daily_range_pct*100:.1f}% range). Institutional footprint."
                })
                
            # PILLAR 7: OPTIONS GAMMA SQUEEZE
            opts = t_obj.options
            if opts:
                chain = t_obj.option_chain(opts[0])
                calls = chain.calls
                otm_calls = calls[calls['strike'] > close_p]
                if not otm_calls.empty:
                    max_vol_call = otm_calls.loc[otm_calls['volume'].idxmax()]
                    if max_vol_call['volume'] > 0 and max_vol_call['openInterest'] > 0:
                        v_oi_ratio = max_vol_call['volume'] / max_vol_call['openInterest']
                        if v_oi_ratio > 1.5:
                            alerts.append({
                                "model": "Gamma Squeeze Trigger",
                                "details": f"Explosive Call Volume/OI ratio ({v_oi_ratio:.1f}x) at ${max_vol_call['strike']} strike forces Dealer hedging."
                            })

        except Exception as e:
            logger.warning(f"Failed to fetch advanced proxies for {ticker}: {e}")

        return {
            "status": "PENDING_BREAKOUT",
            "ticker": ticker,
            "price": round(float(close), 2),
            "rmv": round(float(rmv), 2),
            "rmv_status": rmv_status,
            "alerts": alerts
        }

    except Exception as e:
        logger.error(f"Error evaluating pending breakout for {ticker}: {e}")
        return None

if __name__ == "__main__":
    res = detect_pending_breakout("PLTR")
    if res:
        print(f"[{res['ticker']}]")
        for a in res['alerts']:
            print(f" - {a['model']}: {a['details']}")
    else:
        print("No pending breakout detected for PLTR.")
