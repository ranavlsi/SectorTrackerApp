import yfinance as yf
import pandas as pd
import numpy as np
from scipy.stats import linregress

def evaluate_qullamaggie_setup(ticker, pre_df=None):
    """
    Evaluates a stock against Kristjan Kullamägi's quantitative breakout rules.
    Upgraded with Institutional Momentum rules (Linear Regression, Liquidity, VCP, Pocket Pivots).
    """
    try:
        if pre_df is not None:
            df = pre_df.copy()
        else:
            from yahooquery import Ticker as YQTicker
            t = YQTicker(ticker)
            # Need more data for 50-day volume SMA and 40-day run
            df = t.history(period="6mo", interval="1d")
            if df is None or df.empty or ticker.lower() not in df.index.get_level_values(0).str.lower(): return None
            df = df.loc[ticker.lower() if ticker.lower() in df.index.levels[0] else ticker].reset_index()
            df.rename(columns={'close':'Close', 'high':'High', 'low':'Low', 'open':'Open', 'volume':'Volume'}, inplace=True)
            
        if len(df) < 60: return None
        
        # 0. Basic Cleanup
        df['Close'] = df['Close'].ffill()
        
        # 1. Anti-Penny Liquidity Check ($20M Dollar Volume)
        df['Dollar_Volume'] = df['Close'] * df['Volume']
        if df['Dollar_Volume'].rolling(window=20).mean().iloc[-1] < 20000000:
            return None # Illiquid

        # 2. Calculate ADR (Average Daily Range) over 20 days
        df['Daily_Range_Pct'] = (df['High'] - df['Low']) / df['Close'].shift(1)
        adr_20 = df['Daily_Range_Pct'].rolling(window=20).mean().iloc[-2] * 100
        
        if adr_20 < 4.0:
            return None # Not volatile enough for Qullamaggie
            
        # 3. True Range and ATR
        df['TR'] = np.maximum((df['High'] - df['Low']), 
                              np.maximum(abs(df['High'] - df['Close'].shift(1)), 
                                         abs(df['Low'] - df['Close'].shift(1))))
        df['ATR_3'] = df['TR'].rolling(window=3).mean()
        df['ATR_20'] = df['TR'].rolling(window=20).mean()

        # Moving Averages
        df['SMA_10'] = df['Close'].rolling(window=10).mean()
        df['SMA_20'] = df['Close'].rolling(window=20).mean()
        df['SMA_50_Vol'] = df['Volume'].rolling(window=50).mean()

        # --- Episodic Pivot Check (Bypass standard VCP rules) ---
        from advanced_quant_utils import score_episodic_pivot
        df = score_episodic_pivot(df)
        if df['EP_Score'].iloc[-1] >= 50.0:
            curr_price = df['Close'].iloc[-1]
            gap_high = df['High'].iloc[-1]
            gap_low = df['Low'].iloc[-1]
            
            if curr_price >= gap_low:
                return {
                    "status": "TRIGGERED",
                    "ticker": ticker,
                    "adr": round(adr_20, 1),
                    "price": round(curr_price, 2),
                    "breakout_level": round(gap_high, 2),
                    "sma_support": "Episodic Pivot"
                }

        # 4. HTF / Prior Move Detection (The Parabolic Pole)
        last_40_days = df.iloc[-41:-1].copy() # Exclude today
        
        # Linear Regression on Log Close
        last_40_days['Log_Close'] = np.log(last_40_days['Close'])
        x = np.arange(len(last_40_days))
        slope, intercept, r_value, p_value, std_err = linregress(x, last_40_days['Log_Close'])
        r_squared = r_value ** 2
        
        # Rule: R-squared > 0.60 and slope > 0.005
        if r_squared < 0.60 or slope < 0.005:
            return None # Trend is not smooth/steady enough
            
        # Volume Thrust: At least one day in the last 40 days where volume > 2 * 50-day SMA
        if not (last_40_days['Volume'] > 2 * last_40_days['SMA_50_Vol']).any():
            return None # No institutional volume thrust

        # Largest Down-Day Filter (Loosened to avoid false negatives on single bad days)
        up_days = last_40_days[last_40_days['Close'] > last_40_days['Open']]
        down_days = last_40_days[last_40_days['Close'] < last_40_days['Open']]
        # if not up_days.empty and not down_days.empty:
        #     if down_days['Volume'].max() >= up_days['Volume'].max() * 1.5:
        #         return None # Extreme distribution

        # 5. Consolidation & "Surfing" Check (Price must be tight to SMA)
        # Surfing the 10-day SMA
        min_low_3 = df['Low'].iloc[-4:-1].min()
        min_close_3 = df['Close'].iloc[-4:-1].min()
        sma_10_prev = df['SMA_10'].iloc[-2]
        
        is_surfing = (min_low_3 <= sma_10_prev * 1.05) and (min_close_3 > sma_10_prev * 0.95)
        if not is_surfing:
            return None

        # 6. Adaptive Volatility Contraction & Price Action (AI Quant Engine)
        from advanced_quant_utils import adaptive_volatility_screener, add_price_action_signals, is_vcp_adaptive
        
        # We process the df through the advanced models
        df = adaptive_volatility_screener(df, contraction_days=5, adr_days=20, adr_multiplier=1.2)
        df = add_price_action_signals(df, consolidation_window=10)
        
        # An adaptive VCP must mathematically pass the RMV normalization (Current 5-day range <= 1.2x of its 20-day ADR)
        is_tight_adaptive = df['Is_Tight_ADR'].iloc[-2]
        
        # It must also exhibit at least one pure supply exhaustion signal (NR7 or Inside Bar)
        has_supply_exhaustion = df['NR7'].iloc[-2] or df['IB'].iloc[-2] or df['II'].iloc[-2]
        
        # Or, the pure statistical VCP check passes
        is_pure_vcp = is_vcp_adaptive(df)
        
        if not (is_tight_adaptive or is_pure_vcp):
            return None # Failed dynamic volatility contraction
            
        if not (has_supply_exhaustion or is_pure_vcp):
            return None # Failed micro-structure supply exhaustion

        # 7. Intraday Breakout Trigger (Current price > 15-day Swing High)
        curr_price = df['Close'].iloc[-1]
        swing_high_15 = df['High'].iloc[-16:-1].max()
        
        # --- Failure Detection ---
        # Stop loss capped at 1x 20-day ADR below entry
        max_risk_price = swing_high_15 * (1 - (adr_20 / 100))
        # If it drops below the max risk level OR below the recent structural base low
        recent_low = df['Low'].iloc[-16:-1].min()
        hard_stop = max(max_risk_price, recent_low)
        
        if curr_price < hard_stop:
            return None # Setup failed/stopped out
        
        if curr_price > swing_high_15:
            status = "TRIGGERED"
        else:
            status = "PENDING"
            
        return {
            "status": status,
            "ticker": ticker,
            "adr": round(adr_20, 1),
            "price": round(curr_price, 2),
            "breakout_level": round(swing_high_15, 2),
            "sma_support": "10-Day"
        }

    except Exception as e:
        print(f"[Qullamaggie Engine] Error analyzing {ticker}: {e}")
        return None

if __name__ == "__main__":
    res = evaluate_qullamaggie_setup("ARM")
    print("ARM:", res)
