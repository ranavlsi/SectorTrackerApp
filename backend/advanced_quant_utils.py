import pandas as pd
import numpy as np
from scipy.signal import find_peaks

# ==========================================
# 1. EPISODIC PIVOT (EP) SCORER
# ==========================================
def score_episodic_pivot(df, lookback_days=252):
    """
    Calculates an Episodic Pivot (EP) Quality Score (0-100) for a stock.
    df: pandas DataFrame with 'Open', 'High', 'Low', 'Close', 'Volume'
    """
    df = df.copy()
    
    df['Prev_Close'] = df['Close'].shift(1)
    df['Gap_Pct'] = (df['Open'] - df['Prev_Close']) / df['Prev_Close']
    
    # Rolling percentile of the gap size over the past year
    # We use min_periods=20 so it works even if there isn't a full year of data
    df['Gap_Percentile'] = df['Gap_Pct'].abs().rolling(window=lookback_days, min_periods=20).apply(
        lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, raw=False
    )
    
    # Compare today's volume to the 20-day average volume
    df['Vol_20MA'] = df['Volume'].shift(1).rolling(window=20).mean()
    df['Vol_Ratio'] = df['Volume'] / df['Vol_20MA']
    
    # Close-to-Open Ratio (Intraday Trend)
    df['Close_to_Open_Ret'] = (df['Close'] - df['Open']) / df['Open']
    
    # Candle Close Location
    df['Candle_Close_Pct'] = (df['Close'] - df['Low']) / (df['High'] - df['Low'])
    
    # Filter: Must be a positive gap of at least 4% to even be considered an EP
    is_ep_candidate = df['Gap_Pct'] >= 0.04
    
    # Scoring System
    vol_score = np.clip(df['Vol_Ratio'] / 5.0, 0, 1) * 25
    gap_score = np.clip((df['Gap_Percentile'] - 80) / 20.0, 0, 1) * 25
    cto_score = np.clip(df['Close_to_Open_Ret'] / 0.05, 0, 1) * 25
    candle_score = df['Candle_Close_Pct'] * 25
    
    df['EP_Score'] = vol_score + gap_score + cto_score + candle_score
    df.loc[~is_ep_candidate, 'EP_Score'] = 0 
    
    return df

# ==========================================
# 2. ADAPTIVE VOLATILITY CONTRACTION
# ==========================================
def adaptive_volatility_screener(df, contraction_days=5, adr_days=20, adr_multiplier=1.0, base_tightness=0.025):
    """
    Normalizes the required tightness by historical Average Daily Range (ADR).
    """
    df = df.copy()
    daily_range_pct = (df['High'] - df['Low']) / df['Close'].shift(1)
    df['ADR'] = daily_range_pct.rolling(window=adr_days).mean()
    
    period_high = df['High'].rolling(window=contraction_days).max()
    period_low = df['Low'].rolling(window=contraction_days).min()
    df['Current_Range'] = (period_high - period_low) / period_low
    
    df['ADR_Threshold'] = df['ADR'] * adr_multiplier
    df['Is_Tight_ADR'] = df['Current_Range'] <= df['ADR_Threshold']
    
    # Also calculate standard absolute tightness as fallback
    df['Is_Tight_Abs'] = df['Current_Range'] <= base_tightness
    
    return df

# ==========================================
# 3. PRICE ACTION MICRO-STRUCTURE
# ==========================================
def add_price_action_signals(df, consolidation_window=10):
    df = df.copy()
    
    # NR7
    df['Range'] = df['High'] - df['Low']
    df['NR7'] = df['Range'] <= df['Range'].rolling(window=7).min()
    
    # Inside Bars
    df['IB'] = (df['High'] < df['High'].shift(1)) & (df['Low'] > df['Low'].shift(1))
    df['II'] = df['IB'] & df['IB'].shift(1)
    
    # Pocket Pivots
    is_down_day = df['Close'] < df['Close'].shift(1)
    df['Down_Volume'] = 0
    df.loc[is_down_day, 'Down_Volume'] = df['Volume']
    max_down_vol_10d = df['Down_Volume'].rolling(window=10).max().shift(1)
    is_up_day = df['Close'] > df['Close'].shift(1)
    df['Pocket_Pivot'] = is_up_day & (df['Volume'] > max_down_vol_10d)
    
    # Close-to-High Metrics
    daily_range = df['High'] - df['Low']
    df['Daily_C2H'] = (df['Close'] - df['Low']) / daily_range.replace(0, 1e-8)
    
    recent_high = df['High'].rolling(window=consolidation_window).max()
    recent_low = df['Low'].rolling(window=consolidation_window).min()
    consolidation_range = recent_high - recent_low
    df['Consolidation_C2H'] = (df['Close'] - recent_low) / consolidation_range.replace(0, 1e-8)
    
    return df

# ==========================================
# 4. ADVANCED VCP MATHEMATICS
# ==========================================
def calculate_atr(df, period=14):
    high_low = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close = np.abs(df['Low'] - df['Close'].shift())
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return tr.rolling(period).mean()

def calculate_choppiness_index(df, period=14):
    atr = calculate_atr(df, 1)
    atr_sum = atr.rolling(period).sum()
    highest_high = df['High'].rolling(period).max()
    lowest_low = df['Low'].rolling(period).min()
    chop = 100 * np.log10(atr_sum / (highest_high - lowest_low)) / np.log10(period)
    return chop

def is_vcp_adaptive(df):
    """
    Evaluates pure quantitative VCP conditions using Scipy Peak Detection and BBWP.
    """
    if len(df) < 200:
        return False
    df = df.copy()

    df['SMA50'] = df['Close'].rolling(50).mean()
    df['SMA150'] = df['Close'].rolling(150).mean()
    df['SMA200'] = df['Close'].rolling(200).mean()
    current = df.iloc[-1]
    
    if not (current['Close'] > current['SMA50'] > current['SMA150'] > current['SMA200']):
        return False

    # BBWP
    df['SMA20'] = df['Close'].rolling(20).mean()
    df['STD20'] = df['Close'].rolling(20).std()
    df['BBW'] = (df['STD20'] * 4) / df['SMA20']
    df['BBWP'] = df['BBW'].rolling(126, min_periods=20).apply(lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100)
    
    # SD Compression Ratio
    returns = df['Close'].pct_change()
    vol_10 = returns.rolling(10).std() * np.sqrt(252)
    vol_50 = returns.rolling(50).std() * np.sqrt(252)
    compression_ratio = vol_10.iloc[-1] / vol_50.iloc[-1]

    df['CHOP'] = calculate_choppiness_index(df, 14)
    
    if df['BBWP'].iloc[-1] > 20.0 or compression_ratio > 0.70 or df['CHOP'].iloc[-1] < 40:
        return False

    # Adaptive Swing Contraction
    base_data = df['Close'].iloc[-90:].values
    peaks, _ = find_peaks(base_data, distance=10)
    troughs, _ = find_peaks(-base_data, distance=10)
    
    if len(peaks) < 2 or len(troughs) < 2:
        return False
        
    drawdowns = []
    for peak in peaks:
        subsequent_troughs = troughs[troughs > peak]
        if len(subsequent_troughs) > 0:
            nearest_trough = subsequent_troughs[0]
            peak_price = base_data[peak]
            trough_price = base_data[nearest_trough]
            drop = (peak_price - trough_price) / peak_price
            drawdowns.append(drop)
            
    if len(drawdowns) < 2:
        return False

    d1 = drawdowns[-2]
    d2 = drawdowns[-1]
    
    atr20 = calculate_atr(df, 20).iloc[-1]
    atr_pct = atr20 / current['Close']
    
    # Successive contraction and depth tied to ATR
    if (d2 < d1) and (d2 <= (3.0 * atr_pct)):
        return True

    return False

# ==========================================
# 5. MARKET REGIME HEALTH MONITOR
# ==========================================
class MarketHealthMonitor:
    def __init__(self, spy_data, breadth_data):
        self.spy = spy_data
        self.breadth = breadth_data
        
    def determine_regime(self):
        try:
            current_spy_price = self.spy['Close'].iloc[-1]
            spy_50_ma = self.spy['SMA_50'].iloc[-1]
            spy_200_ma = self.spy['SMA_200'].iloc[-1]
            
            pct_stocks_above_50 = self.breadth['Pct_Above_50_SMA'].iloc[-1]
            
            strong_uptrend = current_spy_price > spy_50_ma > spy_200_ma
            strong_breadth = pct_stocks_above_50 > 60
            poor_breadth = pct_stocks_above_50 < 40
            downtrend = current_spy_price < spy_200_ma
            
            if strong_uptrend and strong_breadth:
                return 'Roaring_Bull'
            elif (current_spy_price > spy_200_ma) and not strong_breadth:
                return 'Choppy_Distribution'
            elif downtrend and poor_breadth:
                return 'Bear'
            else:
                return 'Moderate'
        except Exception:
            # Fallback
            return 'Moderate'

class AdaptiveScreener:
    def __init__(self, market_monitor):
        self.market_monitor = market_monitor
        self.base_criteria = {
            'min_rs_rating': 80,
            'max_base_depth': 0.25,
        }
        
    def get_regime_multipliers(self, regime):
        if regime == 'Roaring_Bull':
            return {'rs': 0.90, 'depth': 1.25} 
        elif regime == 'Choppy_Distribution':
            return {'rs': 1.15, 'depth': 0.60} 
        elif regime == 'Bear':
            return {'rs': 1.20, 'depth': 0.40} 
        else:
            return {'rs': 1.0, 'depth': 1.0}
            
    def generate_dynamic_criteria(self):
        regime = self.market_monitor.determine_regime()
        multipliers = self.get_regime_multipliers(regime)
        criteria = {
            'min_rs_rating': min(99, self.base_criteria['min_rs_rating'] * multipliers['rs']),
            'max_base_depth': self.base_criteria['max_base_depth'] * multipliers['depth']
        }
        return regime, criteria
