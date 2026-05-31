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
        if base_depth > 0.35: return None # Anti-EQIX: Base is too deep/loose
        
        # Position in base (Must be top 15%)
        pos_in_base = (df['Close'].iloc[-1] - df['Base_Low'].iloc[-1]) / (df['Base_High'].iloc[-1] - df['Base_Low'].iloc[-1])
        if pos_in_base < 0.85: return None # Squeezing too low in the base
        
        # Extension Limits (Anti-AVGO): Must be perfectly coiled under local pivot, not breaking out yet
        df['Local_Pivot'] = df['High'].shift(1).rolling(15).max()
        local_pivot = df['Local_Pivot'].iloc[-1]
        close = df['Close'].iloc[-1]
        
        dist_to_pivot = (local_pivot - close) / local_pivot
        # Must be strictly underneath the pivot! If dist <= 0, it already broke out.
        if dist_to_pivot < 0.005 or dist_to_pivot > 0.08: return None
        
        # Smoothness
        df['Daily_Range'] = (df['High'] / df['Low']) - 1
        adr_20 = df['Daily_Range'].rolling(20).mean().iloc[-1] * 100
        if adr_20 > 4.5: return None # Too choppy
        
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
        if up_down_ratio < 1.15: return None # Not enough institutional accumulation
        
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
        
        ttm_squeeze = (df['BB_Upper'].iloc[-1] < df['KC_Upper'].iloc[-1]) and (df['BB_Lower'].iloc[-1] > df['KC_Lower'].iloc[-1])
        if not ttm_squeeze: return None
        
        # PASSES ALL TESTS!
        return {
            "status": "PENDING_BREAKOUT",
            "ticker": ticker,
            "price": round(float(close), 2),
            "alerts": [{
                "model": "V2 VCP Squeeze",
                "details": f"Textbook VCP setup coiled {dist_to_pivot*100:.1f}% under local pivot (${local_pivot:.2f}). Volume dried up with {up_down_ratio:.2f}x accumulation ratio."
            }]
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
